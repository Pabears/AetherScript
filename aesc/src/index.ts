#!/usr/bin/env bun
export * from './decorators';
import { Project, InterfaceDeclaration, ClassDeclaration, ts, Node } from "ts-morph";
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Configuration
const OUTPUT_DIR = 'src/generated';
const LOCK_FILE = 'aesc.lock';

// --- Type Definitions ---
export type PropertyDependency = {
    name: string;
    type: string;
};

export interface OllamaResponse {
    response: string;
}

export type GeneratedService = {
    interfaceName: string;
    implName: string;
    implFilePath: string;
    constructorDependencies: string[];
    propertyDependencies: PropertyDependency[];
};

// --- Lock File Management ---
function getLockData(): string[] {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) || [];
        } catch { return []; }
    }
    return [];
}

function saveLockData(data: string[]) {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(Array.from(new Set(data)), null, 2));
}

function handleLockUnlock(paths: string[], action: 'lock' | 'unlock') {
    const actionFunc = action === 'lock' ? lockFile : unlockFile;
    const actionDirFunc = action === 'lock' ? lockDirectory : unlockDirectory;
    for (const p of paths) {
        try {
            if (fs.statSync(p).isDirectory()) {
                actionDirFunc(p);
            } else {
                actionFunc(p);
            }
        } catch (error: any) {
            console.error(`Error accessing path ${p}:`, error.message);
        }
    }
}

function lockFile(filePath: string) {
    const lockedFiles = getLockData();
    const absolutePath = path.resolve(filePath);
    if (!lockedFiles.includes(absolutePath)) {
        lockedFiles.push(absolutePath);
        saveLockData(lockedFiles);
        console.log(`  -> Locked ${filePath}`);
    }
}

function unlockFile(filePath: string) {
    let lockedFiles = getLockData();
    const absolutePath = path.resolve(filePath);
    const initialCount = lockedFiles.length;
    lockedFiles = lockedFiles.filter(p => p !== absolutePath);
    if (lockedFiles.length < initialCount) {
        saveLockData(lockedFiles);
        console.log(`  -> Unlocked ${filePath}`);
    }
}

function lockDirectory(dirPath: string) {
    const project = new Project();
    project.addSourceFilesAtPaths(`${dirPath}/**/*.ts`);
    const lockedFiles = getLockData();
    let changed = false;
    for (const sourceFile of project.getSourceFiles()) {
        const filePath = path.resolve(sourceFile.getFilePath());
        if (!lockedFiles.includes(filePath)) {
            lockedFiles.push(filePath);
            changed = true;
        }
    }
    if (changed) saveLockData(lockedFiles);
    console.log(`  -> Locked all files in ${dirPath}`);
}

function unlockDirectory(dirPath: string) {
    let lockedFiles = getLockData();
    const absoluteDirPath = path.resolve(dirPath);
    const initialCount = lockedFiles.length;
    lockedFiles = lockedFiles.filter(p => !p.startsWith(absoluteDirPath));
    if (lockedFiles.length < initialCount) {
        saveLockData(lockedFiles);
        console.log(`  -> Unlocked all files in ${dirPath}`);
    }
}

export function getDependencies(cls: ClassDeclaration): { constructorDeps: string[], propertyDeps: PropertyDependency[] } {
    const constructorDeps: string[] = []; // Enforce property injection.
    const propertyDeps: PropertyDependency[] = [];
    const processedClasses = new Set<string>();

    let currentClass: ClassDeclaration | undefined = cls;
    while (currentClass) {
        const name = currentClass.getName();
        if (name && !processedClasses.has(name)) {
            processedClasses.add(name);
            currentClass.getProperties().forEach(prop => {
                if (prop.getDecorator("AutoGen")) {
                    const propType = prop.getType();
                    let typeSymbol = propType.getSymbol();

                    // If it's a union type (e.g., 'DB | undefined'), find the actual type symbol
                    if (propType.isUnion()) {
                        const nonUndefinedType = propType.getUnionTypes().find(t => !t.isUndefined());
                        typeSymbol = nonUndefinedType?.getSymbol();
                    }

                    const typeName = typeSymbol?.getName();

                    if (typeName && !propertyDeps.some(p => p.name === prop.getName())) {
                        propertyDeps.push({ name: prop.getName(), type: typeName });
                    }
                }
            });
        }
        currentClass = currentClass.getBaseClass();
    }

    return { constructorDeps, propertyDeps };
}

// --- Core Generation Logic (User-provided) ---

export async function handleGenerate(force: boolean, files:string[], verbose: boolean) {
    const project = new Project({
        tsConfigFilePath: "tsconfig.json",
    });

    const outputDir = path.join(process.cwd(), OUTPUT_DIR);
    if (force) {
        console.log(`--force specified, cleaning directory: ${outputDir}`);
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    const lockedFiles = getLockData();
    const generatedServices: GeneratedService[] = [];

    console.log("Scanning for @AutoGen decorators...");

    let allSourceFiles = project.getSourceFiles("src/**/*.ts");

    if (files.length > 0) {
        const lowerCaseFiles = files.map(f => f.toLowerCase());
        allSourceFiles = allSourceFiles.filter(sf => {
            const fileName = path.basename(sf.getFilePath()).toLowerCase();
            return lowerCaseFiles.includes(fileName);
        });
    }

    const servicesToGenerate = new Map<string, { declaration: InterfaceDeclaration | ClassDeclaration, sourceFile: any }>();

    // 1. Collect all unique services to generate
    for (const sourceFile of allSourceFiles) {
        const classes = sourceFile.getClasses();
        for (const cls of classes) {
            for (const prop of cls.getProperties()) {
                if (!prop.getDecorator("AutoGen")) continue;

                console.log(`Found @AutoGen on ${cls.getName()}.${prop.getName()}`);
                const propType = prop.getType();
                const targetType = propType.isUnion() ? propType.getUnionTypes().find(t => !t.isUndefined()) : propType;

                if (!targetType) {
                    console.error(`  -> Error: Could not resolve type for ${prop.getName()}`);
                    continue;
                }
                const typeSymbol = targetType.getSymbol();
                if (!typeSymbol) {
                    console.error(`  -> Error: Could not find symbol for type ${targetType.getText()}`);
                    continue;
                }
                const decl = typeSymbol.getDeclarations()[0];
                if (!decl || (!Node.isInterfaceDeclaration(decl) && !(Node.isClassDeclaration(decl) && decl.isAbstract()))) {
                     console.error(`  -> Error: Type ${targetType.getText()} is not a resolvable interface or abstract class.`);
                    continue;
                }
                const interfaceName = decl.getName()!;
                if (!servicesToGenerate.has(interfaceName)) {
                    servicesToGenerate.set(interfaceName, { declaration: decl, sourceFile });
                }
            }
        }
    }

    // 2. Generate implementations for each unique service
    for (const [interfaceName, { declaration, sourceFile }] of servicesToGenerate.entries()) {
        const implName = `${interfaceName}Impl`;
        const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
        const implFilePath = path.join(outputDir, implFileName);

        if (lockedFiles.includes(path.resolve(implFilePath))) {
            console.log(`  -> SKIPPED (locked): ${implFilePath}`);
            continue;
        }
        if (fs.existsSync(implFilePath) && !force) {
            console.log(`  -> SKIPPED: ${implFilePath} already exists. Use --force to overwrite.`);
            continue;
        }

        console.log(`  -> Generating implementation for ${interfaceName}...`);
        const generatedCode = await callOllama(declaration, path.relative(outputDir, sourceFile.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, ''), implFilePath, verbose);

        // If generation failed, callOllama returns an error comment. Skip file writing.
        if (generatedCode.startsWith('// ERROR:')) {
            continue;
        }

        fs.writeFileSync(implFilePath, generatedCode);
        console.log(`  -> Wrote to ${implFilePath}`);

        const implSourceFile = project.createSourceFile(implFilePath, generatedCode, { overwrite: true });
        const implClass = implSourceFile.getClass(c => c.getName() === implName);

        if (implClass) {
            const { constructorDeps, propertyDeps } = getDependencies(implClass);
            generatedServices.push({
                interfaceName,
                implName,
                implFilePath: `./${implFileName}`,
                constructorDependencies: constructorDeps,
                propertyDependencies: propertyDeps,
            });
        } else {
            console.error(`Could not find class ${implName} in generated file ${implFileName}`);
        }
    }

    if (generatedServices.length > 0) {
        console.log("\nGenerating DI container...");
        await generateContainer(outputDir, generatedServices);
        console.log("DI container generated successfully.");
    } else {
        console.log("No @AutoGen decorators found. Nothing to generate.");
    }
}

async function callOllama(declaration: InterfaceDeclaration | ClassDeclaration, originalImportPath: string, generatedFilePath: string, verbose: boolean): Promise<string> {
    const interfaceName = declaration.getName()!;
    const interfaceCode = declaration.getFullText();

    const dependentTypesCode = new Map<string, { code: string, path: string }>();

    const typesToProcess = [
        ...declaration.getMethods().flatMap(m => [...m.getParameters().map(p => p.getType()), m.getReturnType()]),
        ...declaration.getHeritageClauses().flatMap(hc => hc.getTypeNodes().map(tn => tn.getType()))
    ];

    const declarationType = declaration.getType();
    typesToProcess.push(declarationType);

    for (const type of typesToProcess) {
        const symbol = type.getAliasSymbol() ?? type.getSymbol();
        if (!symbol) continue;

        for (const decl of symbol.getDeclarations()) {
            const sourceFile = decl.getSourceFile();
            const declarationFilePath = sourceFile.getFilePath();

            if (sourceFile.isFromExternalLibrary() || sourceFile.isDeclarationFile()) {
                continue;
            }

            const typeName = symbol.getName();
            if (['Promise', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never'].includes(typeName) || typeName === interfaceName) {
                continue;
            }

            if (!dependentTypesCode.has(typeName)) {
                const importPath = path.relative(path.dirname(declaration.getSourceFile().getFilePath()), declarationFilePath).replace(/\.ts$/, '');
                dependentTypesCode.set(typeName, { code: decl.getFullText(), path: importPath });
            }
        }
    }

    let dependentCodeBlock = '';
    if (dependentTypesCode.size > 0) {
        dependentCodeBlock += 'Here are the definitions of the types it depends on:\n\n';
        for (const [typeName, { code, path: importPath }] of dependentTypesCode.entries()) {
            dependentCodeBlock += `From '${importPath}':\n`;
            dependentCodeBlock += `\`\`\`typescript\n${code}\n\`\`\`\n\n`;
        }
    }

    const prompt = `
You are an expert TypeScript developer. Your task is to generate a concrete implementation for the following TypeScript abstract class or interface.
The implementation should be a export public class named '${interfaceName}Impl'.
The generated class must extend or implement the original '${interfaceName}'.
If the base is an abstract class, do not redeclare properties that are already defined in the base class.
Any helper functions you create should be defined as private methods within the implementation class. Use the inherited 'protected' or 'public' members directly.
The generated code should start with a comment like '// Generated by AutoGen...' and include the necessary imports.

The original abstract class or interface is defined in '${originalImportPath}'.

${dependentCodeBlock}Here is the original code:
\`\`\`typescript
${interfaceCode}
\`\`\`

CRITICAL: 
1. You must respond with only the raw TypeScript code for the implementation file. 
2. The response must contain nothing else.
3. the TypeScript code must in \`\`\`typescript \`\`\` 
4. the impl class must not contain constructor
5. Provide only the TypeScript code for the class implementation, without any additional explanations, comments, or markdown formatting.
`;

    if (verbose) {
        console.log("--- OLLAMA PROMPT ---");
        console.log(prompt);
        console.log("---------------------");
    }

    console.log(`  -> Sending prompt to Ollama for ${interfaceName}...`);
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "codellama",
                prompt: prompt,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
        }

        const result = (await response.json()) as OllamaResponse;

        const rawCode = result.response || '';
        // Attempt to extract from ```typescript block first
        let cleanedCode = '';
        const match = /```typescript\n([\s\S]*?)\n```/.exec(rawCode);
        if (match && match[1]) {
            cleanedCode = match[1].trim();
        } else if (rawCode.includes('export class')) {
            // Fallback: If no block is found, but the raw response contains a class export, use the whole response.
            // This handles cases where the model doesn't follow the markdown block instruction.
            cleanedCode = rawCode.trim();
        }

        if (!cleanedCode) {
            if (verbose) {
                console.error(`  -> ERROR: Ollama response for ${interfaceName} did not contain a valid TypeScript code block. Skipping.`);
                console.log("--- RAW OLLAMA RESPONSE ---");
                console.log(rawCode);
                console.log("---------------------------");
            }
            return `// ERROR: Ollama response for ${interfaceName} did not contain a valid TypeScript code block.`;
        }

        cleanedCode = postProcessGeneratedCode(cleanedCode, declaration, generatedFilePath);

        const { isValid, errors } = await validateGeneratedCode(cleanedCode, declaration, generatedFilePath);

        if (!isValid && errors.length > 0) {
            console.error(`  -> ERROR: Generated code for ${interfaceName} failed validation. Skipping.`);
            errors.forEach(err => console.error(`    - ${err}`));
            if (verbose) {
                console.log("--- RAW OLLAMA RESPONSE ---");
                console.log(rawCode);
                console.log("---------------------------");
            }
            return `// ERROR: Generated code for ${interfaceName} failed validation.\n${errors.join('\n// ')}`;
        }

        console.log(`  -> result (post-processed): ${cleanedCode}`);

        return cleanedCode;

    } catch (error) {
        console.error("  -> Error calling Ollama:", error);
        console.error("  -> Falling back to mock implementation.");
        return `// Generated by AutoGen (fallback) at ${new Date().toISOString()}
import { ${interfaceName} } from '${originalImportPath}';

// ERROR: Could not generate implementation from Ollama.
export class ${interfaceName}Impl implements ${interfaceName} {
    // TODO: Implement methods manually.
}
`;
    }
}

async function validateGeneratedCode(code: string, originalDeclaration: InterfaceDeclaration | ClassDeclaration, generatedFilePath: string): Promise<{ isValid: boolean; errors: string[] }> {
    const project = originalDeclaration.getProject();
    const tempSourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });

    try {
        const diagnostics = tempSourceFile.getPreEmitDiagnostics();

        // Correctly handle ts-morph's DiagnosticMessageChain using its API
        const flattenMessages = (chain: import("ts-morph").DiagnosticMessageChain): string => {
            let result = chain.getMessageText();
            const next = chain.getNext();
            if (next) {
                next.forEach(nextChain => {
                    result += ` -> ${flattenMessages(nextChain)}`;
                });
            }
            return result;
        };

        if (diagnostics.length > 0) {
            const errors = diagnostics
                .map(d => {
                    const message = d.getMessageText();
                    return typeof message === 'string' ? message : flattenMessages(message);
                })
                .filter(error => !error.includes("Object is possibly 'undefined'"));

            if (errors.length > 0) {
                return { isValid: false, errors };
            }
        }

        return { isValid: true, errors: [] };
    } finally {
        // IMPORTANT: Remove the temporary file from the project to avoid side effects
        project.removeSourceFile(tempSourceFile);
    }
}

function postProcessGeneratedCode(code: string, declaration: InterfaceDeclaration | ClassDeclaration, generatedFilePath: string): string {
    const project = declaration.getProject();
    // Use a unique temporary name to avoid conflicts
    const tempFilePath = `${generatedFilePath}.tmp.ts`; 
    const tempSourceFile = project.createSourceFile(tempFilePath, code, { overwrite: true });

    try {
        // Manually and robustly fix imports instead of relying on the sometimes buggy fixMissingImports()
        const diagnostics = tempSourceFile.getPreEmitDiagnostics();
        const missingTypeNames = new Set<string>();

        diagnostics.forEach(diagnostic => {
            const message = diagnostic.getMessageText();
            if (typeof message === 'string') {
                const match = message.match(/Cannot find name '(\w+)'/);
                if (match && match[1]) {
                    missingTypeNames.add(match[1]);
                }
            }
        });

        const importDeclarations: { [moduleSpecifier: string]: string[] } = {};

        missingTypeNames.forEach(typeName => {
            let foundDeclaration: any;

            project.getSourceFiles().forEach(sourceFile => {
                if (foundDeclaration) return; // Optimization
                const exportedDecl = sourceFile.getExportedDeclarations().get(typeName);
                if (exportedDecl && exportedDecl.length > 0) {
                    foundDeclaration = exportedDecl[0];
                }
            });

            if (foundDeclaration) {
                const sourceFile = foundDeclaration.getSourceFile();
                if (!sourceFile.isFromExternalLibrary()) {
                    const modulePath = path.relative(path.dirname(tempFilePath), sourceFile.getFilePath()).replace(/\.ts$/, '');
                    const finalModulePath = modulePath.startsWith('.') ? modulePath : `./${modulePath}`;
                    if (!importDeclarations[finalModulePath]) {
                        importDeclarations[finalModulePath] = [];
                    }
                    importDeclarations[finalModulePath].push(typeName);
                }
            }
        });

        for (const moduleSpecifier in importDeclarations) {
            tempSourceFile.insertImportDeclaration(0, {
                namedImports: Array.from(new Set(importDeclarations[moduleSpecifier])),
                moduleSpecifier: moduleSpecifier,
            });
        }

        // Final robust fix: ensure 'extends' is used and remove redeclared properties.
        if (Node.isClassDeclaration(declaration)) {
            const implClass = tempSourceFile.getClass(c => c.isDefaultExport() || c.isExported());
            if (implClass) {
                const baseClassName = declaration.getName()!;

                // 1. Force 'extends' instead of 'implements'
                const implementsIndex = implClass.getImplements().findIndex(i => i.getText() === baseClassName);
                if (implementsIndex !== -1) {
                    implClass.setExtends(baseClassName);
                    implClass.removeImplements(implementsIndex);
                }

                // 2. Now that we're sure it extends, safely remove redeclared properties.
                const basePropertyNames = new Set(declaration.getProperties().map(p => p.getName()));
                implClass.getProperties().forEach(prop => {
                    if (basePropertyNames.has(prop.getName())) {
                        prop.remove();
                    }
                });
            }
        }

        return tempSourceFile.getFullText();
    } finally {
        // IMPORTANT: Clean up the temporary file from the project graph
        project.removeSourceFile(tempSourceFile);
    }
}

export async function generateContainer(outputDir: string, services: GeneratedService[]) {
    const imports = services.map(s => `import { ${s.implName} } from '${s.implFilePath.replace(/\\/g, '/').replace(/\.ts$/, '')}';`).join('\n');

    const typeMappings = services.map(s => `    '${s.interfaceName}': ${s.implName};`).join('\n');

    const factoryMappings = services.map(s => {
        let factoryCode = `        '${s.interfaceName}': () => {\n`;
        factoryCode += `            const instance = new ${s.implName}();\n`;
        s.propertyDependencies.forEach(dep => {
            factoryCode += `            instance.${dep.name} = this.get('${dep.type}');\n`;
        });
        factoryCode += `            return instance;\n`;
        factoryCode += `        }`;
        return factoryCode;
    }).join(',\n');

    const containerCode = `// Generated by AutoGen at ${new Date().toISOString()}
${imports}

interface ServiceMap {
${typeMappings}
}

class Container {
    private instances: Map<keyof ServiceMap, any> = new Map();

    private factories: { [K in keyof ServiceMap]: () => ServiceMap[K] };

    constructor() {
        this.factories = {
${factoryMappings}
        };
    }

    public get<K extends keyof ServiceMap>(identifier: K): ServiceMap[K] {
        if (!this.instances.has(identifier)) {
            const factory = this.factories[identifier];
            if (!factory) {
                throw new Error('Service not found for identifier: ' + identifier);
            }
            const instance = factory();
            this.instances.set(identifier, instance);
        }
        return this.instances.get(identifier) as ServiceMap[K];
    }
}

export const container = new Container();
`;

    const outputPath = path.join(outputDir, 'container.ts');
    fs.writeFileSync(outputPath, containerCode);
}

// --- CLI Setup ---
function main() {
    yargs(hideBin(process.argv))
    .command('gen [files...]', 'Generate implementations for services', (yargs) => {
        return yargs
            .positional('files', { describe: 'A list of interface/class names or filenames to generate.', type: 'string', array: true, default: [] })
            .option('force', { alias: 'f', type: 'boolean', description: 'Force overwrite of existing implementation files', default: false })
            .option('verbose', { alias: 'v', type: 'boolean', description: 'Print the full prompt sent to Ollama for debugging', default: false });
    }, (argv) => {
        handleGenerate(argv.force, argv.files as string[], argv.verbose).catch(err => console.error("An unexpected error occurred:", err));
    })
    .command('lock <paths...>', 'Lock a file or a directory to prevent regeneration', (yargs) => {
        return yargs.positional('paths', { describe: 'File or directory paths to lock', type: 'string', demandOption: true, array: true });
    }, (argv) => handleLockUnlock(argv.paths as string[], 'lock'))
    .command('unlock <paths...>', 'Unlock a file or a directory', (yargs) => {
        return yargs.positional('paths', { describe: 'File or directory paths to unlock', type: 'string', demandOption: true, array: true });
    }, (argv) => handleLockUnlock(argv.paths as string[], 'unlock'))
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .parse();
}

// Run the CLI only if the script is executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    main();
}
