#!/usr/bin/env bun
/**
 * aesc container-gen — 扫描 src/generated/ 中已生成的 impl，自动生成类型安全的 DI container.ts
 *
 * 用法：
 *   bun src/container-gen.ts [--project <dir>]
 *
 * 输出：src/generated/container.ts
 */

import { Project, Node } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface PropertyDependency {
    name: string;
    type: string;
}

interface GeneratedService {
    implName: string;
    baseName: string;       // Abstract class / interface name (key in ServiceMap)
    implFilePath: string;   // Relative import path from container.ts
    autoGenProps: PropertyDependency[];  // @AutoGen properties on the base class
}

// ────────────────────────────────────────────────────────────
// Core Logic
// ────────────────────────────────────────────────────────────

export function generateContainer(projectDir: string): void {
    const tsConfigPath = findTsConfig(projectDir);
    if (!tsConfigPath) {
        throw new Error(`Could not find tsconfig.json in ${projectDir}`);
    }

    const project = new Project({ tsConfigFilePath: tsConfigPath });
    const generatedDir = path.join(projectDir, 'src', 'generated');

    if (!fs.existsSync(generatedDir)) {
        console.log('⚠️  No src/generated/ directory found. Nothing to do.');
        return;
    }

    // ── Step 1: Determine which impl files participate in DI ──
    // Read .aesc-scan.json to honour generateDI:false per class.
    // Falls back to scanning all *.impl.ts in src/generated/ if no scan JSON.
    const scanJsonPath = path.join(projectDir, '.aesc-scan.json');
    const diExcludedBaseNames = new Set<string>();

    if (fs.existsSync(scanJsonPath)) {
        const scanResult = JSON.parse(fs.readFileSync(scanJsonPath, 'utf-8'));
        for (const cls of (scanResult.classes ?? [])) {
            if (cls.moduleConfig?.generateDI === false) {
                diExcludedBaseNames.add(cls.className);
            }
        }
        if (diExcludedBaseNames.size > 0) {
            console.log(`ℹ️  Skipping DI for: ${[...diExcludedBaseNames].join(', ')} (generateDI: false)`);
        }
    }

    // ── Step 2: Collect .impl.ts files from src/generated/ only ──
    // (frontend impls live elsewhere and are excluded via generateDI:false)
    const implFiles = fs.readdirSync(generatedDir)
        .filter(f => f.endsWith('.impl.ts') && f !== 'container.ts')
        .sort();

    if (implFiles.length === 0) {
        console.log('⚠️  No impl files found in src/generated/');
        return;
    }

    // ── Step 3: For each impl, find the base class — skip if generateDI:false ──
    const services: GeneratedService[] = [];

    for (const implFile of implFiles) {
        const implFilePath = path.join(generatedDir, implFile);
        const sf = project.addSourceFileAtPath(implFilePath);

        for (const cls of sf.getClasses()) {
            if (!cls.isExported()) continue;

            const implName = cls.getName();
            if (!implName || !implName.endsWith('Impl')) continue;

            // Find what it extends
            const extendsExpr = cls.getExtends();
            const baseName = extendsExpr
                ? extendsExpr.getExpression().getText().split('<')[0]?.trim()
                : undefined;

            if (!baseName) continue;

            // Skip classes marked generateDI:false
            if (diExcludedBaseNames.has(baseName)) continue;

            // Find the base class to get @AutoGen properties
            const baseClass = findClassByName(project, baseName);
            const autoGenProps: PropertyDependency[] = [];

            if (baseClass) {
                for (const prop of baseClass.getProperties()) {
                    if (!prop.getLeadingCommentRanges().some(r => r.getText().includes('@AutoGen'))) continue;

                    const propType = prop.getType();
                    const targetType = propType.isUnion()
                        ? propType.getUnionTypes().find(t => !t.isUndefined())
                        : propType;

                    if (targetType) {
                        autoGenProps.push({
                            name: prop.getName(),
                            type: targetType.getText().split('.').pop()!,  // Strip module prefix
                        });
                    }
                }
            }

            const relPath = `./${path.basename(implFile, '.ts')}`;
            services.push({ implName, baseName, implFilePath: relPath, autoGenProps });
        }
    }

    if (services.length === 0) {
        console.log('⚠️  No exported DI-eligible Impl classes found. Container not generated.');
        return;
    }

    // ── Step 4: Generate container code ──
    const containerCode = buildContainerCode(services);
    const containerPath = path.join(generatedDir, 'container.ts');
    fs.writeFileSync(containerPath, containerCode, 'utf-8');

    console.log(`✅ Generated container.ts with ${services.length} service(s):`);
    services.forEach(s => console.log(`   - ${s.baseName} → ${s.implName}`));
}

function buildContainerCode(services: GeneratedService[]): string {
    const imports = services
        .map(s => `import { ${s.implName} } from '${s.implFilePath}';`)
        .join('\n');

    const typeMappings = services
        .map(s => `    '${s.baseName}': ${s.implName};`)
        .join('\n');

    const factoryEntries = services.map(s => {
        const propAssignments = s.autoGenProps
            .map(p => `            instance.${p.name} = this.get('${p.type}');`)
            .join('\n');

        return [
            `        '${s.baseName}': () => {`,
            `            const instance = new ${s.implName}();`,
            propAssignments,
            `            return instance;`,
            `        }`,
        ].join('\n');
    }).join(',\n');

    return `// Generated by aesc container-gen — DO NOT EDIT
// Re-run \`bun src/container-gen.ts\` to regenerate
${imports}

interface ServiceMap {
${typeMappings}
}

class Container {
    private instances: Map<keyof ServiceMap, any> = new Map();

    private factories: { [K in keyof ServiceMap]: () => ServiceMap[K] } = {
${factoryEntries}
    };

    public get<K extends keyof ServiceMap>(identifier: K): ServiceMap[K] {
        if (!this.instances.has(identifier)) {
            const factory = this.factories[identifier];
            if (!factory) {
                throw new Error(\`Service not found: \${String(identifier)}\`);
            }
            this.instances.set(identifier, factory());
        }
        return this.instances.get(identifier) as ServiceMap[K];
    }
}

export const container = new Container();
`;
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

function findClassByName(project: Project, name: string) {
    for (const sf of project.getSourceFiles()) {
        const cls = sf.getClass(name);
        if (cls) return cls;
    }
    return undefined;
}

// ────────────────────────────────────────────────────────────
// CLI Entry
// ────────────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    let projectDir = process.cwd();

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project' && args[i + 1]) {
            projectDir = path.resolve(args[i + 1]!);
            i++;
        }
    }

    console.log(`\n🏗️  Generating DI container for: ${projectDir}\n`);
    try {
        generateContainer(projectDir);
    } catch (err) {
        console.error('❌ Error:', err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
    main();
}
