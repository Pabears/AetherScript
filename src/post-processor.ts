#!/usr/bin/env bun
/**
 * aesc post-processor — 验证 + 修复生成的 impl 文件
 *
 * 用法：
 *   bun src/post-processor.ts [--project <dir>] [--file <impl-file>]
 *
 * 功能：
 *   1. ts-morph 编译检查（in-memory TypeScript）
 *   2. 自动修复 import 缺失
 *   3. 修复 implements AbstractClass → extends AbstractClass
 *   4. 删除 impl 中与 base class 重复声明的 property
 *   5. 输出验证报告
 */

import {
    Project,
    Node,
    type ClassDeclaration,
    type InterfaceDeclaration,
    type SourceFile,
} from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface PostProcessResult {
    filePath: string;
    success: boolean;
    fixed: boolean;       // 是否做了自动修复
    errors: string[];     // 仍然存在的编译错误（修复后）
}

// ────────────────────────────────────────────────────────────
// Core Logic
// ────────────────────────────────────────────────────────────

export function postProcessFile(
    implFilePath: string,
    project: Project
): PostProcessResult {
    const absPath = path.resolve(implFilePath);

    if (!fs.existsSync(absPath)) {
        return { filePath: implFilePath, success: false, fixed: false, errors: [`File not found: ${absPath}`] };
    }

    let code = fs.readFileSync(absPath, 'utf-8');
    let fixed = false;

    // ── Fix 1: implements AbstractClass → extends AbstractClass ──
    // AI often writes `implements` for abstract classes instead of `extends`
    const project2 = new Project({ tsConfigFilePath: findTsConfig(path.dirname(absPath)) });
    const abstractClasses = collectAbstractClassNames(project2);

    for (const name of abstractClasses) {
        const implementsPattern = new RegExp(`\\bimplements\\s+${name}\\b`, 'g');
        if (implementsPattern.test(code)) {
            code = code.replace(implementsPattern, `extends ${name}`);
            fixed = true;
            console.log(`  🔧 Fixed: implements ${name} → extends ${name}`);
        }
    }

    // ── Fix 2: Remove properties re-declared in impl that exist in base class ──
    const tempProject = new Project({ useInMemoryFileSystem: true });
    let tempFile = tempProject.createSourceFile('temp.ts', code, { overwrite: true });

    for (const implClass of tempFile.getClasses()) {
        const extendsExpr = implClass.getExtends();
        if (!extendsExpr) continue;

        const baseClassName = extendsExpr.getExpression().getText().split('<')[0]?.trim();
        if (!baseClassName) continue;

        // Find the base class in the real project
        const baseClass = findClassByName(project2, baseClassName);
        if (!baseClass) continue;

        const basePropertyNames = new Set(baseClass.getProperties().map(p => p.getName()));
        const removedProps: string[] = [];

        for (const prop of implClass.getProperties()) {
            if (basePropertyNames.has(prop.getName())) {
                removedProps.push(prop.getName());
                prop.remove();
                fixed = true;
            }
        }

        if (removedProps.length > 0) {
            console.log(`  🔧 Removed re-declared props in ${implClass.getName()}: ${removedProps.join(', ')}`);
        }
    }

    if (fixed) {
        code = tempFile.getFullText();
    }

    // ── Fix 3: Auto-fix missing imports ──
    const fixResult = fixImports(code, absPath, project2);
    if (fixResult.fixed) {
        code = fixResult.code;
        fixed = true;
        console.log(`  🔧 Fixed imports: added ${fixResult.addedImports.join(', ')}`);
    }

    // Write fixed code back if changed
    if (fixed) {
        fs.writeFileSync(absPath, code, 'utf-8');
    }

    // ── Validate final result ──
    const errors = validateFile(absPath, project2);

    return {
        filePath: implFilePath,
        success: errors.length === 0,
        fixed,
        errors,
    };
}

function findTsConfig(startDir: string): string | undefined {
    let dir = startDir;
    for (let i = 0; i < 10; i++) {
        const candidate = path.join(dir, 'tsconfig.json');
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return undefined;
}

function collectAbstractClassNames(project: Project): string[] {
    const names: string[] = [];
    for (const sf of project.getSourceFiles()) {
        if (sf.getFilePath().includes('/generated/')) continue;
        for (const cls of sf.getClasses()) {
            if (cls.isAbstract()) {
                const name = cls.getName();
                if (name) names.push(name);
            }
        }
    }
    return names;
}

function findClassByName(project: Project, name: string): ClassDeclaration | undefined {
    for (const sf of project.getSourceFiles()) {
        const cls = sf.getClass(name);
        if (cls) return cls;
    }
    return undefined;
}

interface ImportFixResult {
    code: string;
    fixed: boolean;
    addedImports: string[];
}

function fixImports(code: string, filePath: string, project: Project): ImportFixResult {
    const tempProject = new Project({ useInMemoryFileSystem: true });
    const tempFile = tempProject.createSourceFile(filePath, code, { overwrite: true });

    const diagnostics = tempFile.getPreEmitDiagnostics();
    const missingTypeNames = new Set<string>();

    for (const diag of diagnostics) {
        const msg = diag.getMessageText();
        const msgText = typeof msg === 'string' ? msg : msg.getMessageText();
        const match = msgText.match(/Cannot find name '(\w+)'/);
        if (match?.[1]) missingTypeNames.add(match[1]);
    }

    if (missingTypeNames.size === 0) {
        return { code, fixed: false, addedImports: [] };
    }

    const importDeclarations: Record<string, string[]> = {};
    const addedImports: string[] = [];

    for (const typeName of missingTypeNames) {
        // Search in project source files
        for (const sf of project.getSourceFiles()) {
            if (sf.getFilePath() === filePath) continue;

            const exportedDecls = sf.getExportedDeclarations().get(typeName);
            if (exportedDecls && exportedDecls.length > 0) {
                const declFile = exportedDecls[0]!.getSourceFile();
                if (!declFile.isFromExternalLibrary()) {
                    const relativePath = path
                        .relative(path.dirname(filePath), declFile.getFilePath())
                        .replace(/\.ts$/, '');
                    const modulePath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;

                    if (!importDeclarations[modulePath]) importDeclarations[modulePath] = [];
                    importDeclarations[modulePath].push(typeName);
                    addedImports.push(typeName);
                }
                break;
            }
        }
    }

    let insertIndex = 0;
    for (const [moduleSpecifier, names] of Object.entries(importDeclarations)) {
        const uniqueNames = [...new Set(names)];
        tempFile.insertImportDeclaration(insertIndex, {
            namedImports: uniqueNames,
            moduleSpecifier,
        });
        insertIndex++;
    }

    return { code: tempFile.getFullText(), fixed: addedImports.length > 0, addedImports };
}

function validateFile(filePath: string, project: Project): string[] {
    // Re-load the (potentially fixed) file into the project
    let sf = project.getSourceFile(filePath);
    if (sf) {
        sf.refreshFromFileSystemSync();
    } else {
        sf = project.addSourceFileAtPath(filePath);
    }

    const diagnostics = sf.getPreEmitDiagnostics();

    const flattenMsg = (msg: string | import('ts-morph').DiagnosticMessageChain): string => {
        if (typeof msg === 'string') return msg;
        let result = msg.getMessageText();
        const next = msg.getNext();
        if (next) next.forEach(n => { result += ` → ${flattenMsg(n)}`; });
        return result;
    };

    return diagnostics
        .map(d => flattenMsg(d.getMessageText()))
        .filter(e => !e.includes("Object is possibly 'undefined'"));
}

// ────────────────────────────────────────────────────────────
// CLI Entry
// ────────────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    let projectDir = process.cwd();
    let targetFile: string | undefined;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project' && args[i + 1]) {
            projectDir = path.resolve(args[i + 1]!);
            i++;
        } else if (args[i] === '--file' && args[i + 1]) {
            targetFile = path.resolve(args[i + 1]!);
            i++;
        }
    }

    const tsConfigPath = findTsConfig(projectDir);
    if (!tsConfigPath) {
        console.error('❌ Could not find tsconfig.json');
        process.exit(1);
    }

    const project = new Project({ tsConfigFilePath: tsConfigPath });

    const generatedDir = path.join(projectDir, 'src', 'generated');
    const filesToProcess: string[] = [];

    if (targetFile) {
        filesToProcess.push(targetFile);
    } else {
        // Prefer reading outputPaths from .aesc-scan.json for multi-target support
        const scanJsonPath = path.join(projectDir, '.aesc-scan.json');
        if (fs.existsSync(scanJsonPath)) {
            const scanResult = JSON.parse(fs.readFileSync(scanJsonPath, 'utf-8'));
            const seen = new Set<string>();
            for (const cls of (scanResult.classes ?? [])) {
                const outputPath: string = cls.outputPath ?? '';
                if (!outputPath) continue;
                const absImplPath = path.resolve(projectDir, outputPath);
                if (!seen.has(absImplPath) && fs.existsSync(absImplPath)) {
                    seen.add(absImplPath);
                    filesToProcess.push(absImplPath);
                }
            }
        }
        // Fallback: scan src/generated/ if no scan json or no paths found there
        if (filesToProcess.length === 0 && fs.existsSync(generatedDir)) {
            for (const f of fs.readdirSync(generatedDir)) {
                if (f.endsWith('.impl.ts')) {
                    filesToProcess.push(path.join(generatedDir, f));
                }
            }
        }
    }

    if (filesToProcess.length === 0) {
        console.log('⚠️  No impl files found to post-process.');
        return;
    }

    console.log(`\n🔍 Post-processing ${filesToProcess.length} file(s)...\n`);

    let allOk = true;
    for (const f of filesToProcess) {
        console.log(`Processing: ${path.relative(projectDir, f)}`);
        const result = postProcessFile(f, project);

        if (result.success) {
            console.log(`  ✅ OK${result.fixed ? ' (fixed)' : ''}`);
        } else {
            allOk = false;
            console.log(`  ❌ ${result.errors.length} error(s) remaining:`);
            result.errors.forEach(e => console.log(`     - ${e}`));
        }
    }

    console.log(`\n${allOk ? '✅ All files validated successfully.' : '❌ Some files have errors. Please review.'}`);
    if (!allOk) process.exit(1);
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
    main();
}
