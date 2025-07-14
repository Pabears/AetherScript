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
                    const typeNode = prop.getTypeNode();
                    let typeName = typeNode?.getText();

                    // Handle optional types like 'DB | undefined' or 'DB?'
                    if (typeName) {
                        if (typeName.includes('|')) {
                            typeName = typeName.split('|').map(s => s.trim()).find(s => s !== 'undefined' && s !== 'null') || typeName;
                        }
                        if (prop.hasQuestionToken()) {
                            // This case is for 'prop?: Type' syntax, but getTypeNode already includes the text.
                            // The check is implicit in how we extract the type name string.
                        }
                    }

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

export async function handleGenerate(force: boolean, files:string[], verbose: boolean, model: string) {
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
                    const dependencySourceFile = decl.getSourceFile();
                    servicesToGenerate.set(interfaceName, { declaration: decl, sourceFile: dependencySourceFile });
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
        const originalImportPath = path.relative(path.dirname(implFilePath), declaration.getSourceFile().getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
        const generatedCode = await callOllama(declaration, originalImportPath, implFilePath, verbose, model);

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

async function callOllama(declaration: InterfaceDeclaration | ClassDeclaration, originalImportPath: string, generatedFilePath: string, verbose: boolean, model: string): Promise<string> {
    const project = declaration.getProject();
    const interfaceName = declaration.getName();
    if (!interfaceName) {
        throw new Error("Cannot generate implementation for an anonymous class or interface.");
    }

    const dependentTypes = new Map<string, { path: string, code: string }>();

    const addDependencies = (node: Node) => {
        if (!node || !node.getSourceFile) return;
        const sourceFile = node.getSourceFile();
        if (sourceFile.isFromExternalLibrary() || sourceFile.isDeclarationFile()) return;

        const types = node.getDescendantsOfKind(ts.SyntaxKind.TypeReference);
        types.forEach(typeRef => {
            const symbol = typeRef.getType().getSymbol();
            if (symbol) {
                const name = symbol.getName();
                if (['Promise', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never'].includes(name) || dependentTypes.has(name)) return;
                for (const decl of symbol.getDeclarations()) {
                    const declSourceFile = decl.getSourceFile();
                    if (declSourceFile && !declSourceFile.isFromExternalLibrary()) {
                        const importPath = path.relative(path.dirname(generatedFilePath), declSourceFile.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
                        dependentTypes.set(name, { path: importPath, code: decl.getText() });
                        addDependencies(decl);
                    }
                }
            }
        });
    };

    addDependencies(declaration);

    const dependenciesText = Array.from(dependentTypes.entries())
        .map(([_, { path, code }]) => `// From: ${path}\n${code}`)
        .join('\n\n');

    const originalCode = declaration.getText();
    const fixedOriginalCode = originalCode.replace(/\.len\b/g, '.length');

    // This is the new, much stricter prompt
    const prompt = `You are a TypeScript code generation engine.
Your task is to implement the following abstract class.
You must follow these rules strictly:
1. The implementation class name must be '${interfaceName}Impl'.
2. The implementation class MUST 'extend' the original abstract class '${interfaceName}'.
3. You MUST implement all abstract methods.
4. You MUST NOT redeclare any properties already present in the base class. Access them with 'this'.
5. Your response MUST be only the raw TypeScript code. No explanations, no markdown.

Here are the dependent type definitions:
\`\`\`typescript
${dependenciesText}
\`\`\`

Here is the abstract class you must implement:
\`\`\`typescript
${fixedOriginalCode}
\`\`\`
`;

    if (verbose) {
        console.log("--- OLLAMA PROMPT ---");
        console.log(prompt);
        console.log("---------------------");
    }

    console.log(`  -> Sending prompt to Ollama for ${interfaceName}...`);
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
    });

    if (!response.ok) {
        throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const ollamaResponse = await response.json() as OllamaResponse;
    
    if (verbose) {
        console.log("--- OLLAMA RESPONSE (RAW) ---");
        console.log(ollamaResponse.response);
        console.log("----------------------------");
    }

    let cleanedCode = ollamaResponse.response.trim();
    const tsBlockRegex = /```typescript\s*([\s\S]*?)\s*```/;
    const match = cleanedCode.match(tsBlockRegex);
    if (match && match[1]) {
        cleanedCode = match[1].trim();
    } else {
         // Fallback for when the model doesn't use markdown blocks
        if (cleanedCode.startsWith("```")) {
            cleanedCode = cleanedCode.substring(3);
        }
        if (cleanedCode.endsWith("```")) {
            cleanedCode = cleanedCode.slice(0, -3);
        }
    }


    if (verbose) {
        console.log("--- CODE BEFORE POST-PROCESSING ---");
        console.log(cleanedCode);
        console.log("---------------------------------");
    }

    const processedCode = postProcessGeneratedCode(cleanedCode, declaration, generatedFilePath);

    if (verbose) {
        console.log("--- CODE AFTER POST-PROCESSING ---");
        console.log(processedCode);
        console.log("--------------------------------");
    }

    const { isValid, errors } = await validateGeneratedCode(processedCode, declaration, generatedFilePath);
    if (!isValid) {
        console.error(`  -> ERROR: Generated code for ${interfaceName} failed validation. Skipping.`);
        errors.forEach(err => console.error(`    - ${err}`));
        if (verbose) {
            console.log("--- FAILED CODE --- ");
            console.log(processedCode);
            console.log("-------------------");
        }
        return '';
    }

    return processedCode;
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
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });

    const interfaceName = declaration.getName()!;
    const implName = `${interfaceName}Impl`;
    const implClass = sourceFile.getClass(implName);

    if (!implClass) {
        return code; // Not much we can do if the class isn't found
    }

    // --- 1. Fix Imports ---
    const requiredImports = new Map<string, Set<string>>();

    const addImport = (type: import("ts-morph").Type) => {
        const symbol = type.getAliasSymbol() ?? type.getSymbol();
        if (!symbol) return;

        const typeName = symbol.getName();
        if (['Promise', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never'].includes(typeName)) return;

        for (const decl of symbol.getDeclarations()) {
            const depSourceFile = decl.getSourceFile();
            if (depSourceFile.isFromExternalLibrary() || depSourceFile.isDeclarationFile()) continue;

            const importPath = path.relative(path.dirname(generatedFilePath), depSourceFile.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
            const finalPath = importPath.startsWith('.') ? importPath : `./${importPath}`;

            if (!requiredImports.has(finalPath)) {
                requiredImports.set(finalPath, new Set());
            }
            requiredImports.get(finalPath)!.add(typeName);
        }
    };

    // Add import for the base class/interface itself
    addImport(declaration.getType());

    // Add imports for all types used in properties, methods, and heritage clauses
    declaration.getProperties().forEach(p => addImport(p.getType()));
    declaration.getMethods().forEach(m => {
        m.getParameters().forEach(p => addImport(p.getType()));
        addImport(m.getReturnType());
    });
    declaration.getHeritageClauses().forEach(hc => {
        hc.getTypeNodes().forEach(tn => addImport(tn.getType()));
    });

    // Remove all existing import declarations
    sourceFile.getImportDeclarations().forEach(importDecl => importDecl.remove());

    // Add the corrected and consolidated imports
    for (const [moduleSpecifier, names] of requiredImports.entries()) {
        sourceFile.insertImportDeclaration(0, {
            moduleSpecifier,
            namedImports: Array.from(names),
        });
    }

    // --- 2. Clean Up Class Body ---
    if (Node.isClassDeclaration(declaration) && declaration.isAbstract()) {
        const baseProperties = new Set(declaration.getProperties().map(p => p.getName()));
        implClass.getProperties().forEach(prop => {
            if (baseProperties.has(prop.getName())) {
                console.log(`  -> INFO: Removing redeclared property '${prop.getName()}' from '${implName}'`);
                prop.remove();
            }
        });
    }

    return sourceFile.getFullText();
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
            .option('verbose', { alias: 'v', type: 'boolean', description: 'Print the full prompt sent to Ollama for debugging', default: false })
            .option('model', { alias: 'm', type: 'string', description: 'Specify the Ollama model to use', default: 'codellama' });
    }, (argv) => {
        handleGenerate(argv.force, argv.files as string[], argv.verbose, argv.model).catch(err => console.error("An unexpected error occurred:", err));
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
