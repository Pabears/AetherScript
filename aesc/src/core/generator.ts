import { Project, Node, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import * as path from 'path';
import * as fs from 'fs';

// Import workflow modules
import { analyzeSourceFiles, getDependencies, type GeneratedService } from '../file-analysis';
import { generatePrompt } from '../prompt-generator';
import { callOllamaModel } from '../model-caller';
import { cleanGeneratedCode } from '../generation/code-cleaner';
import { postProcessGeneratedCode, validateGeneratedCode } from '../generation/post-processor';
import { 
    generateContainer, 
    saveGeneratedFile, 
    ensureOutputDirectory, 
    getLockData, 
    handleLockUnlock 
} from '../file-saver';
import { fixGeneratedCode } from '../generation/code-fixer';
import type { GenerateOptions } from '../types';
import { getConfig } from '../config';

// File generation statistics
export interface FileStats {
    interfaceName: string;
    status: 'generated' | 'skipped' | 'locked' | 'error';
    duration?: number;
    error?: string;
}

export interface GenerationResult {
    success: boolean;
    fileStats: FileStats[];
    totalDuration: number;
    generatedServices: GeneratedService[];
}

/**
 * Scan for all existing service implementation files and combine with newly generated services
 * This ensures that skipped files are still registered in the container
 */
export async function getAllExistingServices(
    outputDir: string, 
    project: Project, 
    newlyGeneratedServices: GeneratedService[]
): Promise<GeneratedService[]> {
    const allServices: GeneratedService[] = [...newlyGeneratedServices];
    
    if (!fs.existsSync(outputDir)) {
        return allServices;
    }

    const files = fs.readdirSync(outputDir);
    const implFiles = files.filter(file => file.endsWith('.service.impl.ts'));
    
    for (const file of implFiles) {
        const filePath = path.join(outputDir, file);
        const interfaceName = path.basename(file, '.service.impl.ts')
            .split('.')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
        
        // Skip if already in newly generated services
        if (newlyGeneratedServices.some(s => s.interfaceName === interfaceName)) {
            continue;
        }
        
        try {
            // Add the file to the project for analysis
            const sourceFile = project.addSourceFileAtPath(filePath);
            const classes = sourceFile.getClasses();
            
            if (classes.length > 0) {
                const implClass = classes[0];
                if (implClass) {
                    const { constructorDeps, propertyDeps } = getDependencies(implClass);
                    
                    allServices.push({
                        interfaceName,
                        implName: implClass.getName() || `${interfaceName}Impl`,
                        implFilePath: `./${file}`,
                        constructorDependencies: constructorDeps,
                        propertyDependencies: propertyDeps,
                    });
                }
            }
        } catch (error) {
            console.warn(`Warning: Could not analyze existing service file ${file}: ${error}`);
        }
    }
    
    return allServices;
}

/**
 * Core code generation function
 */
export async function generateCode(options: GenerateOptions): Promise<GenerationResult> {
    const totalStartTime = Date.now();
    const config = getConfig();
    
    console.log(`🚀 Starting code generation at ${new Date().toLocaleTimeString()}`);
    
    const project = new Project({
        tsConfigFilePath: "tsconfig.json",
    });

    const outputDir = path.join(process.cwd(), config.outputDir);
    
    // Step 1: File Analysis - Ensure output directory
    // Only clean entire directory if force is used AND no specific files are specified
    const shouldCleanEntireDirectory = options.force && options.files.length === 0;
    ensureOutputDirectory(outputDir, shouldCleanEntireDirectory);

    const lockedFiles = getLockData();
    const generatedServices: GeneratedService[] = [];

    console.log("Scanning for @AutoGen decorators...");

    // Step 1: File Analysis - Analyze source files
    const servicesToGenerate = analyzeSourceFiles(project, options.files);

    console.log(`📋 Found ${servicesToGenerate.size} service(s) to generate`);
    
    // Statistics tracking
    const fileStats: FileStats[] = [];

    // Step 2-6: Generate implementations for each unique service using workflow
    for (const [interfaceName, { declaration, sourceFile }] of servicesToGenerate.entries()) {
        const fileStartTime = Date.now();
        const implName = `${interfaceName}Impl`;
        const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
        const implFilePath = path.join(outputDir, implFileName);

        try {
            if (lockedFiles.includes(path.resolve(implFilePath))) {
                console.log(`  -> SKIPPED (locked): ${implFilePath}`);
                fileStats.push({
                    interfaceName,
                    status: 'locked',
                    duration: Date.now() - fileStartTime
                });
                continue;
            }
            
            // If force is used with specific files, delete only the corresponding impl file
            if (options.force && options.files.length > 0 && fs.existsSync(implFilePath)) {
                console.log(`  -> FORCE: Deleting existing file: ${implFilePath}`);
                fs.unlinkSync(implFilePath);
            }
            
            if (fs.existsSync(implFilePath) && !options.force) {
                console.log(`  -> SKIPPED: ${implFilePath} already exists. Use --force to overwrite.`);
                fileStats.push({
                    interfaceName,
                    status: 'skipped',
                    duration: Date.now() - fileStartTime
                });
                continue;
            }

            console.log(`  -> Generating implementation for ${interfaceName}...`);
            const originalImportPath = path.relative(path.dirname(implFilePath), declaration.getSourceFile().getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
            
            // Step 2: Prompt Generate
            const prompt = generatePrompt(declaration, originalImportPath, implFilePath, options.provider);
            
            // Step 3: Model Call
            const rawResponse = await callOllamaModel(prompt, interfaceName, options.model, options.verbose, options.provider);
            
            // Step 4: Code Clear
            const cleanedCode = cleanGeneratedCode(rawResponse, interfaceName, options.verbose);
            
            // Step 5: Post Process
            let processedCode = postProcessGeneratedCode(cleanedCode, declaration, implFilePath);
            
            if (options.verbose) {
                console.log("--- CODE AFTER POST-PROCESSING ---");
                console.log(processedCode);
                console.log("--------------------------------");
            }

            let { isValid, errors } = await validateGeneratedCode(processedCode, declaration, implFilePath);
            
            // If validation fails, try to fix the code using the same model and provider
            if (!isValid) {
                const fixResult = await fixGeneratedCode(
                    processedCode,
                    declaration,
                    implFilePath,
                    originalImportPath,
                    interfaceName,
                    errors,
                    options.model,
                    options.verbose,
                    options.provider
                );
                
                if (fixResult.success && fixResult.fixedCode) {
                    processedCode = fixResult.fixedCode;
                    isValid = true;
                } else {
                    // If fix failed, record error and continue to next file
                    const fileDuration = Date.now() - fileStartTime;
                    fileStats.push({
                        interfaceName,
                        status: 'error',
                        duration: fileDuration,
                        error: `Validation failed after ${fixResult.attempts} retry attempts`
                    });
                    continue;
                }
            }

            // Step 6: Save File
            saveGeneratedFile(implFilePath, processedCode);

            // Extract dependencies from the original declaration, not the generated implementation
            const { constructorDeps, propertyDeps } = Node.isClassDeclaration(declaration) 
                ? getDependencies(declaration as any)
                : { constructorDeps: [], propertyDeps: [] };
                
            if (options.verbose) {
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
            
            const fileDuration = Date.now() - fileStartTime;
            fileStats.push({
                interfaceName,
                status: 'generated',
                duration: fileDuration
            });
            
            console.log(`  -> ✅ ${interfaceName} completed in ${(fileDuration / 1000).toFixed(2)}s`);
        } catch (error) {
            const fileDuration = Date.now() - fileStartTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  -> ❌ Failed to generate ${interfaceName}: ${errorMessage}`);
            fileStats.push({
                interfaceName,
                status: 'error',
                duration: fileDuration,
                error: errorMessage
            });
        }
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

    const totalDuration = Date.now() - totalStartTime;
    
    return {
        success: fileStats.filter(f => f.status === 'error').length === 0,
        fileStats,
        totalDuration,
        generatedServices: allServices
    };
}
