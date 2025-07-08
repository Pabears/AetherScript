import { Project, InterfaceDeclaration, ClassDeclaration, ts, Node } from "ts-morph";
import * as fs from 'fs';
import * as path from 'path';

type GeneratedService = {
    interfaceName: string;
    implName: string;
    implFilePath: string;
    dependencies: string[];
};

async function main() {
    const project = new Project({
        tsConfigFilePath: "tsconfig.json",
    });

    const outputDir = path.join(__dirname, 'src', 'generated');
    fs.rmSync(outputDir, { recursive: true, force: true }); // Clean previous generations
    fs.mkdirSync(outputDir, { recursive: true });

    const allSourceFiles = project.getSourceFiles("src/**/*.ts");
    const generatedServices: GeneratedService[] = [];

    console.log("Scanning for @AutoGen decorators...");

    for (const sourceFile of allSourceFiles) {
        const classes = sourceFile.getClasses();
        for (const cls of classes) {
            const properties = cls.getProperties();
            for (const prop of properties) {
                const decorator = prop.getDecorator("AutoGen");
                if (!decorator) continue;

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

                const declaration = decl;
                const interfaceName = declaration.getName()!;
                const implName = `${interfaceName}Impl`;
                const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
                const implFilePath = path.join(outputDir, implFileName);

                console.log(`  -> Generating implementation for ${interfaceName}...`);
                const generatedCode = await callOllama(declaration, path.relative(outputDir, sourceFile.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, ''), implFilePath);
                fs.writeFileSync(implFilePath, generatedCode);
                console.log(`  -> Wrote to ${implFilePath}`);

                // Analyze constructor dependencies of the generated class
                const tempProject = new Project({ useInMemoryFileSystem: true });
                const tempSourceFile = tempProject.createSourceFile('temp.ts', generatedCode);
                const implClass = tempSourceFile.getClass(c => c.getName() === implName);
                const constructorDeps = implClass?.getConstructors()[0]?.getParameters().map(p => p.getType().getText()) || [];

                generatedServices.push({
                    interfaceName,
                    implName,
                    implFilePath: `./${implFileName}`,
                    dependencies: constructorDeps,
                });
            }
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

/**
 * Calls a local Ollama instance to generate a class implementation from an interface.
 * @param interfaceDeclaration The interface to implement.
 * @param originalImportPath The relative path to the original interface file.
 * @returns A string containing the generated class code.
 */
async function callOllama(declaration: InterfaceDeclaration | ClassDeclaration, originalImportPath: string, generatedFilePath: string): Promise<string> {
    const interfaceName = declaration.getName()!;
    const interfaceCode = declaration.getFullText();

    // --- AST Analysis to find dependent types ---
    const dependentTypesCode = new Map<string, { code: string, path: string }>();

    const typesToProcess = [
        ...declaration.getMethods().flatMap(m => [...m.getParameters().map(p => p.getType()), m.getReturnType()]),
        ...declaration.getHeritageClauses().flatMap(hc => hc.getTypeNodes().map(tn => tn.getType()))
    ];

    // Add the declaration itself to ensure it gets imported
    const declarationType = declaration.getType();
    typesToProcess.push(declarationType);

    for (const type of typesToProcess) {
        const symbol = type.getAliasSymbol() ?? type.getSymbol();
        if (!symbol) continue;

        for (const decl of symbol.getDeclarations()) {
            const sourceFile = decl.getSourceFile();
            const declarationFilePath = sourceFile.getFilePath();

            // Skip primitive types and types from node_modules
            if (sourceFile.isFromExternalLibrary() || sourceFile.isDeclarationFile()) {
                continue;
            }



            const typeName = symbol.getName();
            // Skip primitive types and Promise/void
            if (['Promise', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never'].includes(typeName)) {
                continue;
            }

            // If the type is in the same file, we don't need a separate import path for it.
            const isSameFile = declarationFilePath === declaration.getSourceFile().getFilePath();

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

    // Construct the prompt for the LLM
    const prompt = `
You are an expert TypeScript developer. Your task is to generate a concrete implementation for the following TypeScript abstract class or interface.
The implementation should be a export class named '${interfaceName}Impl'.
The generated class must extend or implement the original '${interfaceName}'.
If the base is an abstract class, do not redeclare properties that are already defined in the base class.
Any helper functions you create should be defined as private methods within the implementation class. Use the inherited 'protected' or 'public' members directly.
Provide only the TypeScript code for the class implementation, without any additional explanations, comments, or markdown formatting.
The generated code should start with a comment like '// Generated by AutoGen...' and include the necessary imports.

The original abstract class or interface is defined in '${originalImportPath}'.

${dependentCodeBlock}Here is the original code:
\`\`\`typescript
${interfaceCode}
\`\`\`

CRITICAL: 
1. You must respond with only the raw TypeScript code for the implementation file. 
2. The response should contain nothing else.
3. the TypeScript code must in \`\`\`typescript \`\`\` block
`;

    console.log(`  -> Sending prompt to Ollama for ${interfaceName}...`);
    // console.log(`  -> prompt: ${prompt}`); // Prompt is too long for console
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "codellama", // IMPORTANT: Change this to your desired Ollama model
                prompt: prompt,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
        }

        const result = await response.json();

        // Clean up the response from the LLM, removing markdown fences
        const rawCode = result.response || '';
        let cleanedCode = rawCode.replace(/```typescript/g, '').replace(/```/g, '').trim();

        // Post-process the generated code to fix common LLM mistakes
        cleanedCode = postProcessGeneratedCode(cleanedCode, declaration, originalImportPath, generatedFilePath);

        console.log(`  -> result (post-processed): ${cleanedCode}`);

        return cleanedCode;

    } catch (error) {
        console.error("  -> Error calling Ollama:", error);
        // Fallback to a mock implementation in case of error
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

function postProcessGeneratedCode(code: string, declaration: InterfaceDeclaration | ClassDeclaration, originalImportPath: string, generatedFilePath: string): string {
    // Create a temporary source file in memory with the correct final file path
    const tempProject = new Project({ compilerOptions: declaration.getProject().getCompilerOptions() });
    const sourceFile = tempProject.createSourceFile(generatedFilePath, code);
    
    // Add all project files to the temp project to resolve modules
    declaration.getProject().getSourceFiles().forEach(sf => {
        if (fs.existsSync(sf.getFilePath()) && !tempProject.getSourceFile(sf.getFilePath())) {
            tempProject.addSourceFileAtPath(sf.getFilePath());
        }
    });

    // 1. Ensure the base class/interface is imported.
    const declarationName = declaration.getName()!;
    let importDeclaration = sourceFile.getImportDeclaration(d => d.getModuleSpecifierValue() === originalImportPath);

    if (!importDeclaration) {
        importDeclaration = sourceFile.insertImportDeclaration(0, { moduleSpecifier: originalImportPath });
    }

    const namedImports = importDeclaration.getNamedImports();
    if (!namedImports.some(ni => ni.getName() === declarationName)) {
        importDeclaration.addNamedImport(declarationName);
    }

    // 2. If it's a class, remove redeclared properties from the generated implementation.
    if (Node.isClassDeclaration(declaration)) {
        const implClass = sourceFile.getClass(c => !!c.getName()?.endsWith('Impl'));
        if (implClass) {
            const baseProperties = declaration.getProperties().map(p => p.getName());
            implClass.getProperties().forEach(p => {
                if (baseProperties.includes(p.getName())) {
                    p.remove();
                }
            });
        }
    }

    // 3. Verify and fix all imports based on the project's structure.
    const project = tempProject; // Use the temporary project for analysis
    const allImports = sourceFile.getImportDeclarations();

    for (const importDecl of allImports) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        for (const namedImport of importDecl.getNamedImports()) {
            const typeName = namedImport.getName();
            const typeSourceFile = project.getSourceFile(sf => sf.getExportedDeclarations().has(typeName));
            if (typeSourceFile) {
                                const correctPath = path.relative(path.dirname(generatedFilePath), typeSourceFile.getFilePath()).replace(/\.ts$/, '');
                const correctModuleSpecifier = correctPath.startsWith('.') ? correctPath : `./${correctPath}`;
                if (moduleSpecifier !== correctModuleSpecifier) {
                    importDecl.setModuleSpecifier(correctModuleSpecifier);
                    break; // Move to the next import declaration once updated
                }
            }
        }
    }

    sourceFile.organizeImports();

    return sourceFile.getFullText();
}

async function generateContainer(outputDir: string, services: GeneratedService[]) {
    const imports = services.map(s => `import { ${s.implName} } from '${s.implFilePath.replace(/\\/g, '/').replace(/\.ts$/, '')}';`).join('\n');

    const typeMappings = services.map(s => `    '${s.interfaceName}': ${s.implName};`).join('\n');

    const factoryMappings = services.map(s => {
        const deps = s.dependencies.map(dep => `this.get('${dep}')`).join(', ');
        return `        '${s.interfaceName}': () => new ${s.implName}(${deps})`;
    }).join(',\n');

    const containerCode = `// Generated by AutoGen at ${new Date().toISOString()}
${imports}

// A simple map of interface names to implementation classes
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

main().catch(err => {
    console.error("An unexpected error occurred:", err);
});