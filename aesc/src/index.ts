#!/usr/bin/env bun
export * from './decorators';
import { Project, Node, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Import workflow modules
import { analyzeSourceFiles, getDependencies, type GeneratedService } from './file-analysis';
import { generatePrompt } from './prompt-generator';
import { callOllamaModel } from './model-caller';
import { cleanGeneratedCode } from './code-cleaner';
import { postProcessGeneratedCode, validateGeneratedCode } from './post-processor';
import { 
    generateContainer, 
    saveGeneratedFile, 
    ensureOutputDirectory, 
    getLockData, 
    handleLockUnlock 
} from './file-saver';
import { indexJSDocCommand, clearJSDocIndexCommand } from './commands/index-jsdoc';

// Configuration
const OUTPUT_DIR = 'src/generated';

// Re-export types for backward compatibility
export type { PropertyDependency, GeneratedService } from './file-analysis';
export type { OllamaResponse } from './model-caller';

// --- Core Generation Logic (User-provided) ---

/**
 * Scan for all existing service implementation files and combine with newly generated services
 * This ensures that skipped files are still registered in the container
 * Uses AST analysis to extract real interface names and dependencies from implementation files
 */
async function getAllExistingServices(
    outputDir: string, 
    project: Project, 
    newlyGeneratedServices: GeneratedService[]
): Promise<GeneratedService[]> {
    const allServices: GeneratedService[] = [...newlyGeneratedServices];
    const processedInterfaces = new Set(newlyGeneratedServices.map(s => s.interfaceName));
    
    if (!fs.existsSync(outputDir)) {
        return allServices;
    }
    
    // Scan for existing service implementation files
    const files = fs.readdirSync(outputDir);
    const serviceImplFiles = files.filter(file => file.endsWith('.service.impl.ts'));
    
    for (const file of serviceImplFiles) {
        const filePath = path.join(outputDir, file);
        
        try {
            // Use AST analysis to extract the real interface name from the implementation file
            const implSourceFile = project.addSourceFileAtPath(filePath);
            const classes = implSourceFile.getClasses();
            
            if (classes.length === 0) {
                console.log(`  -> Warning: No classes found in ${file}`);
                continue;
            }
            
            const implClass = classes[0]; // Should be the implementation class
            if (!implClass) {
                console.log(`  -> Warning: No implementation class found in ${file}`);
                continue;
            }
            
            const implClassName = implClass.getName();
            
            if (!implClassName || !implClassName.endsWith('Impl')) {
                console.log(`  -> Warning: Invalid implementation class name in ${file}: ${implClassName}`);
                continue;
            }
            
            // Extract interface name by removing 'Impl' suffix
            const interfaceName = implClassName.replace(/Impl$/, '');
            
            // Skip if already processed in current run
            if (processedInterfaces.has(interfaceName)) {
                continue;
            }
            
            // Find the original interface/abstract class declaration
            const sourceFiles = project.getSourceFiles();
            let originalDeclaration: InterfaceDeclaration | ClassDeclaration | undefined;
            
            for (const sourceFile of sourceFiles) {
                // Skip the implementation file itself
                if (sourceFile.getFilePath() === filePath) {
                    continue;
                }
                
                const interfaces = sourceFile.getInterfaces();
                const classes = sourceFile.getClasses();
                
                const foundInterface = interfaces.find(i => i.getName() === interfaceName);
                if (foundInterface) {
                    originalDeclaration = foundInterface;
                    break;
                }
                
                const foundClass = classes.find(c => c.getName() === interfaceName && c.isAbstract());
                if (foundClass) {
                    originalDeclaration = foundClass;
                    break;
                }
            }
            
            if (originalDeclaration) {
                // Extract dependencies from the original declaration using the same logic as handleGenerate
                const { constructorDeps, propertyDeps } = Node.isClassDeclaration(originalDeclaration) 
                    ? getDependencies(originalDeclaration as any)
                    : { constructorDeps: [], propertyDeps: [] };
                
                allServices.push({
                    interfaceName,
                    implName: implClassName,
                    implFilePath: `./${file}`,
                    constructorDependencies: constructorDeps,
                    propertyDependencies: propertyDeps,
                });
                
                console.log(`  -> Found existing service: ${interfaceName}`);
            } else {
                console.log(`  -> Warning: Could not find original declaration for ${interfaceName}`);
            }
        } catch (error) {
            console.error(`  -> Error processing existing service file ${file}:`, error);
        }
    }
    
    return allServices;
}

export async function handleGenerate(force: boolean, files: string[], verbose: boolean, model: string) {
    const project = new Project({
        tsConfigFilePath: "tsconfig.json",
    });

    const outputDir = path.join(process.cwd(), OUTPUT_DIR);
    
    // Step 1: File Analysis - Ensure output directory
    ensureOutputDirectory(outputDir, force);

    const lockedFiles = getLockData();
    const generatedServices: GeneratedService[] = [];

    console.log("Scanning for @AutoGen decorators...");

    // Step 1: File Analysis - Analyze source files
    const servicesToGenerate = analyzeSourceFiles(project, files);

    // Step 2-6: Generate implementations for each unique service using workflow
    for (const [interfaceName, { declaration, sourceFile }] of servicesToGenerate.entries()) {
        const implName = `${interfaceName}Impl`;
        const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
        const implFilePath = path.join(outputDir, implFileName);

        if (lockedFiles.includes(path.resolve(implFilePath))) {
            console.log(`  -> SKIPPED (locked): ${implFilePath}`);
            continue;
        }
        if (require('fs').existsSync(implFilePath) && !force) {
            console.log(`  -> SKIPPED: ${implFilePath} already exists. Use --force to overwrite.`);
            continue;
        }

        console.log(`  -> Generating implementation for ${interfaceName}...`);
        const originalImportPath = path.relative(path.dirname(implFilePath), declaration.getSourceFile().getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
        
        // Step 2: Prompt Generate
        const prompt = generatePrompt(declaration, originalImportPath, implFilePath);
        
        // Step 3: Model Call
        const rawResponse = await callOllamaModel(prompt, interfaceName, model, verbose);
        
        // Step 4: Code Clear
        const cleanedCode = cleanGeneratedCode(rawResponse, interfaceName, verbose);
        
        // Step 5: Post Process
        let processedCode = postProcessGeneratedCode(cleanedCode, declaration, implFilePath);
        
        if (verbose) {
            console.log("--- CODE AFTER POST-PROCESSING ---");
            console.log(processedCode);
            console.log("--------------------------------");
        }

        let { isValid, errors } = await validateGeneratedCode(processedCode, declaration, implFilePath);
        
        // If validation fails, try to fix the code using ollama (up to 3 attempts)
        if (!isValid) {
            console.log(`  -> WARNING: Generated code for ${interfaceName} failed validation. Attempting to fix with ollama...`);
            errors.forEach(err => console.log(`    - ${err}`));
            
            let retryCount = 0;
            const maxRetries = 3;
            let currentCode = processedCode;
            
            while (!isValid && retryCount < maxRetries) {
                retryCount++;
                console.log(`  -> Retry attempt ${retryCount}/${maxRetries} for ${interfaceName}...`);
                
                // Create a fix prompt with current code, error messages, and dependency information
                // Re-generate the dependency information for the fix prompt
                const dependencyPrompt = generatePrompt(declaration, originalImportPath, implFilePath);
                
                // Extract the dependency section from the original prompt
                const dependencyMatch = dependencyPrompt.match(/Here are the dependent type definitions:[\s\S]*?```typescript([\s\S]*?)```[\s\S]*?Here is the abstract class/m);
                const dependenciesText = dependencyMatch && dependencyMatch[1] ? dependencyMatch[1].trim() : '';
                
                const fixPrompt = `The following TypeScript code has validation errors. Please fix the code to resolve these issues.

${dependenciesText ? `Here are the dependent type definitions:
\`\`\`typescript
${dependenciesText}
\`\`\`

` : ''}Current code with errors:
\`\`\`typescript
${currentCode}
\`\`\`

Validation errors:
${errors.map(err => `- ${err}`).join('\n')}

Please provide the corrected TypeScript code that fixes these validation errors. The corrected code should:
1. Use the correct import syntax for dependencies (e.g., default imports vs named imports)
2. Follow the provided type definitions and API documentation
3. Return only the corrected code without any explanations.`;
                
                try {
                    const fixedResponse = await callOllamaModel(fixPrompt, `${interfaceName}-fix-${retryCount}`, model, verbose);
                    const fixedCode = cleanGeneratedCode(fixedResponse, interfaceName, verbose);
                    const fixedProcessedCode = postProcessGeneratedCode(fixedCode, declaration, implFilePath);
                    
                    // Validate the fixed code
                    const validationResult = await validateGeneratedCode(fixedProcessedCode, declaration, implFilePath);
                    isValid = validationResult.isValid;
                    errors = validationResult.errors;
                    
                    if (isValid) {
                        console.log(`  -> SUCCESS: Code fixed on attempt ${retryCount}`);
                        currentCode = fixedProcessedCode;
                        processedCode = fixedProcessedCode; // Update the main processedCode variable
                    } else {
                        console.log(`  -> Attempt ${retryCount} failed. Errors:`);
                        errors.forEach(err => console.log(`    - ${err}`));
                        currentCode = fixedProcessedCode; // Use the latest attempt for next retry
                    }
                } catch (error) {
                    console.error(`  -> Error during retry attempt ${retryCount}: ${error}`);
                }
            }
            
            // If still not valid after all retries, skip this file
            if (!isValid) {
                console.error(`  -> ERROR: Generated code for ${interfaceName} failed validation after ${maxRetries} retry attempts. Skipping.`);
                if (verbose) {
                    console.log("--- FINAL FAILED CODE --- ");
                    console.log(currentCode);
                    console.log("-------------------------");
                }
                continue;
            }
        }

        // Step 6: Save File
        saveGeneratedFile(implFilePath, processedCode);

        // Extract dependencies from the original declaration, not the generated implementation
        const { constructorDeps, propertyDeps } = Node.isClassDeclaration(declaration) 
            ? getDependencies(declaration as any)
            : { constructorDeps: [], propertyDeps: [] };
            
        if (verbose) {
            console.log(`  -> Dependencies for ${interfaceName}:`);
            console.log(`     Constructor deps: ${JSON.stringify(constructorDeps)}`);
            console.log(`     Property deps: ${JSON.stringify(propertyDeps)}`);
        }
            
        generatedServices.push({
            interfaceName,
            implName,
            implFilePath: `./${implFileName}`,
            constructorDependencies: constructorDeps,
            propertyDependencies: propertyDeps,
        });
    }

    // Always generate container to include all existing services, not just newly processed ones
    console.log("\nGenerating DI container...");
    
    // Scan for all existing service implementation files in the output directory
    const allServices = await getAllExistingServices(outputDir, project, generatedServices);
    
    if (allServices.length > 0) {
        await generateContainer(outputDir, allServices);
        console.log(`DI container generated successfully with ${allServices.length} services.`);
    } else {
        console.log("No services found to register in container.");
    }
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
    .command('index-jsdoc [path]', 'Index JSDoc documentation for all dependencies', (yargs) => {
        return yargs.positional('path', { describe: 'Project path to index (defaults to current directory)', type: 'string' });
    }, (argv) => {
        indexJSDocCommand(argv.path).catch(err => console.error('JSDoc indexing failed:', err));
    })
    .command('clear-jsdoc [path]', 'Clear JSDoc index cache', (yargs) => {
        return yargs.positional('path', { describe: 'Project path to clear cache for (defaults to current directory)', type: 'string' });
    }, (argv) => {
        clearJSDocIndexCommand(argv.path);
    })
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .parse();
}

// Run the CLI only if the script is executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    main();
}
