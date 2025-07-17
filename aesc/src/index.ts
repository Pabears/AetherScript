#!/usr/bin/env bun
export * from './decorators';
import { Project, Node } from "ts-morph";
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
        const processedCode = postProcessGeneratedCode(cleanedCode, declaration, implFilePath);
        
        if (verbose) {
            console.log("--- CODE AFTER POST-PROCESSING ---");
            console.log(processedCode);
            console.log("--------------------------------");
        }

        const { isValid, errors } = await validateGeneratedCode(processedCode, declaration, implFilePath);
        if (!isValid) {
            console.error(`  -> ERROR: Generated code for ${interfaceName} failed validation. Skipping.`);
            errors.forEach(err => console.error(`    - ${err}`));
            if (verbose) {
                console.log("--- FAILED CODE --- ");
                console.log(processedCode);
                console.log("-------------------");
            }
            continue;
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

    if (generatedServices.length > 0) {
        console.log("\nGenerating DI container...");
        await generateContainer(outputDir, generatedServices);
        console.log("DI container generated successfully.");
    } else {
        console.log("No @AutoGen decorators found. Nothing to generate.");
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
