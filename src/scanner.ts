#!/usr/bin/env bun
/**
 * aesc scanner — 扫描项目中所有 @AutoGen 标记的 abstract class / interface
 *
 * 用法：
 *   bun src/scanner.ts [--project <tsconfig-path>] [--output <json-path>]
 *
 * 输出：.aesc-scan.json，供 Antigravity agent 读取后生成 impl
 */

import { Project, Node, type InterfaceDeclaration, type ClassDeclaration } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IModuleConfigLoaderImpl } from './generated/imoduleconfigloader.impl.ts';
import type { AescModuleConfig } from './module-config.ts';

const configLoader = new IModuleConfigLoaderImpl();

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ScannedMethod {
    name: string;
    signature: string;       // 完整方法签名（含 params + return type）
    jsDoc: string;           // 完整 JSDoc 注释原文
    isAbstract: boolean;
}

export interface ScannedProperty {
    name: string;
    type: string;
    isAutoGen: boolean;      // 是否标注了 @AutoGen（需要 DI 注入）
}

export interface ScannedDependency {
    typeName: string;
    sourceCode: string;      // 依赖类型的完整源码（让 agent 理解类型约束）
}

export interface ScannedClass {
    className: string;
    filePath: string;        // 相对于项目根的路径
    isAbstractClass: boolean;
    isInterface: boolean;
    sourceCode: string;      // 整个 abstract class / interface 的完整源码
    methods: ScannedMethod[];
    properties: ScannedProperty[];
    autoGenDependencies: ScannedDependency[];  // @AutoGen 属性的类型的源码
    outputPath: string;      // 建议的输出路径，e.g. src/generated/userservice.impl.ts
    moduleConfig: AescModuleConfig;  // 从 aesccfg.json 读取的模块配置（含默认值）
}

export interface ScanResult {
    scannedAt: string;
    projectRoot: string;
    outputDir: string;
    classes: ScannedClass[];
}

// ────────────────────────────────────────────────────────────
// Core Scanner Logic
// ────────────────────────────────────────────────────────────

export function scan(projectRoot: string, tsConfigPath?: string): ScanResult {
    const resolvedRoot = path.resolve(projectRoot);
    const configPath = tsConfigPath
        ? path.resolve(tsConfigPath)
        : path.join(resolvedRoot, 'tsconfig.json');

    const project = new Project({
        tsConfigFilePath: configPath,
        skipAddingFilesFromTsConfig: false,
    });

    const outputDir = 'src/generated';
    const result: ScanResult = {
        scannedAt: new Date().toISOString(),
        projectRoot: resolvedRoot,
        outputDir,
        classes: [],
    };

    const allSourceFiles = project.getSourceFiles();

    // ── Step 1: 找出所有含 @AutoGen 属性的类，收集需要实现的目标类型 ──
    const targetClassNames = new Set<string>();

    for (const sourceFile of allSourceFiles) {
        // 跳过 generated/ 目录
        const filePath = sourceFile.getFilePath();
        if (filePath.includes('/generated/')) continue;

        for (const cls of sourceFile.getClasses()) {
            for (const prop of cls.getProperties()) {
                if (!prop.getLeadingCommentRanges().some(r => r.getText().includes('@AutoGen'))) continue;

                const propType = prop.getType();
                const targetType = propType.isUnion()
                    ? propType.getUnionTypes().find(t => !t.isUndefined())
                    : propType;

                if (!targetType) continue;
                const typeSymbol = targetType.getSymbol();
                if (!typeSymbol) continue;

                const decls = typeSymbol.getDeclarations();
                for (const decl of decls) {
                    if (Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl)) {
                        const name = decl.getName();
                        if (name) targetClassNames.add(name);
                    }
                }
            }
        }
    }

    // ── Step 2: 同时扫描 // @autogen 注释的 abstract class ──
    for (const sourceFile of allSourceFiles) {
        const filePath = sourceFile.getFilePath();
        if (filePath.includes('/generated/')) continue;

        const fullText = sourceFile.getFullText();
        // 检测文件级别或类级别的 @autogen 注释
        if (fullText.includes('@autogen') || fullText.includes('// @autogen')) {
            for (const cls of sourceFile.getClasses()) {
                if (!cls.isAbstract()) continue;
                const name = cls.getName();
                if (name) targetClassNames.add(name);
            }
        }
    }

    if (targetClassNames.size === 0) {
        console.log('⚠️  No @AutoGen decorated properties or @autogen abstract classes found.');
        return result;
    }

    console.log(`📋 Found ${targetClassNames.size} class(es) to generate: ${[...targetClassNames].join(', ')}`);

    // ── Step 3: 对每个目标类，提取完整信息 ──
    for (const sourceFile of allSourceFiles) {
        const filePath = sourceFile.getFilePath();
        if (filePath.includes('/generated/')) continue;

        for (const cls of sourceFile.getClasses()) {
            const name = cls.getName();
            if (!name || !targetClassNames.has(name)) continue;

            const scanned = extractClassInfo(cls, resolvedRoot, outputDir);
            result.classes.push(scanned);
        }

        for (const iface of sourceFile.getInterfaces()) {
            const name = iface.getName();
            if (!name || !targetClassNames.has(name)) continue;

            const scanned = extractInterfaceInfo(iface, resolvedRoot, outputDir);
            result.classes.push(scanned);
        }
    }

    return result;
}

function extractClassInfo(
    cls: ClassDeclaration,
    projectRoot: string,
    outputDir: string
): ScannedClass {
    const name = cls.getName()!;
    const filePath = path.relative(projectRoot, cls.getSourceFile().getFilePath());

    const methods: ScannedMethod[] = cls.getMethods().map(m => ({
        name: m.getName(),
        signature: m.getFullText().trim(),
        jsDoc: m.getJsDocs().map(d => d.getFullText()).join('\n').trim(),
        isAbstract: m.isAbstract(),
    }));

    const properties: ScannedProperty[] = cls.getProperties().map(p => ({
        name: p.getName(),
        type: p.getType().getText(),
        isAutoGen: p.getLeadingCommentRanges().some(r => r.getText().includes('@AutoGen')),
    }));

    // 收集 @AutoGen 属性对应的依赖类型源码
    const autoGenDeps: ScannedDependency[] = [];
    for (const prop of cls.getProperties()) {
        if (!prop.getLeadingCommentRanges().some(r => r.getText().includes('@AutoGen'))) continue;

        const propType = prop.getType();
        const targetType = propType.isUnion()
            ? propType.getUnionTypes().find(t => !t.isUndefined())
            : propType;
        if (!targetType) continue;

        const typeSymbol = targetType.getSymbol();
        if (!typeSymbol) continue;

        for (const decl of typeSymbol.getDeclarations()) {
            if (Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl)) {
                autoGenDeps.push({
                    typeName: decl.getName()!,
                    sourceCode: decl.getSourceFile().getFullText(),
                });
            }
        }
    }

    const implFileName = `${name.toLowerCase()}.impl.ts`;

    // Read aesccfg.json from the class's directory (bubble-up)
    const absFilePath = cls.getSourceFile().getFilePath();
    const moduleConfig = configLoader.load(absFilePath, projectRoot);
    const outputPath = path.join(moduleConfig.outputPath, implFileName).replace(/\\/g, '/');

    return {
        className: name,
        filePath,
        isAbstractClass: cls.isAbstract(),
        isInterface: false,
        sourceCode: cls.getSourceFile().getFullText(),
        methods,
        properties,
        autoGenDependencies: autoGenDeps,
        outputPath,
        moduleConfig,
    };
}

function extractInterfaceInfo(
    iface: InterfaceDeclaration,
    projectRoot: string,
    outputDir: string
): ScannedClass {
    const name = iface.getName();
    const filePath = path.relative(projectRoot, iface.getSourceFile().getFilePath());

    const methods: ScannedMethod[] = iface.getMethods().map(m => ({
        name: m.getName(),
        signature: m.getFullText().trim(),
        jsDoc: m.getJsDocs().map(d => d.getFullText()).join('\n').trim(),
        isAbstract: true,
    }));

    const properties: ScannedProperty[] = iface.getProperties().map(p => ({
        name: p.getName(),
        type: p.getType().getText(),
        isAutoGen: false,
    }));

    const implFileName = `${name.toLowerCase()}.impl.ts`;

    // Read aesccfg.json from the interface's directory (bubble-up)
    const absFilePath = iface.getSourceFile().getFilePath();
    const moduleConfig = configLoader.load(absFilePath, projectRoot);
    const outputPath = path.join(moduleConfig.outputPath, implFileName).replace(/\\/g, '/');

    return {
        className: name,
        filePath,
        isAbstractClass: false,
        isInterface: true,
        sourceCode: iface.getSourceFile().getFullText(),
        methods,
        properties,
        autoGenDependencies: [],
        outputPath,
        moduleConfig,
    };
}

// ────────────────────────────────────────────────────────────
// CLI Entry
// ────────────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    let projectPath = process.cwd();
    let outputFile = path.join(process.cwd(), '.aesc-scan.json');

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project' && args[i + 1]) {
            projectPath = path.resolve(args[i + 1]!);
            // If --project points to a tsconfig.json file, use its directory as projectPath
            if (args[i + 1]!.endsWith('.json')) {
                outputFile = path.join(path.dirname(projectPath), '.aesc-scan.json');
            } else {
                outputFile = path.join(projectPath, '.aesc-scan.json');
            }
            i++;
        } else if (args[i] === '--output' && args[i + 1]) {
            outputFile = path.resolve(args[i + 1]!);
            i++;
        }
    }

    console.log(`🔍 Scanning project at: ${projectPath}`);

    const result = scan(projectPath);

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n✅ Scan complete. Found ${result.classes.length} class(es).`);
    console.log(`📄 Output written to: ${outputFile}`);

    if (result.classes.length > 0) {
        console.log('\nClasses to generate:');
        for (const cls of result.classes) {
            console.log(`  - ${cls.className} → ${cls.outputPath}`);
            console.log(`    Methods: ${cls.methods.map(m => m.name).join(', ')}`);
        }
    }
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
    main();
}
