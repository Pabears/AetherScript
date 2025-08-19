import { Project, Node, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import * as path from 'path';
import * as fs from 'fs';

// Import workflow modules
import { analyzeSourceFiles, getDependencies, type GeneratedService } from '../file-analysis';
import { generateDependencyInfo } from './dependency-analyzer';
import { generatePrompt } from '../prompts/implementation';
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
import { JSDocIndexer } from '../jsdoc/indexer';

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
                    // Try to find the original abstract class/interface to get dependencies
                    let constructorDeps: string[] = [];
                    let propertyDeps: any[] = [];
                    
                    // Look for the base class (the abstract class this implementation extends)
                    const baseClass = implClass.getBaseClass();
                    if (baseClass) {
                        // Get dependencies from the original abstract class
                        const baseDeps = getDependencies(baseClass);
                        constructorDeps = baseDeps.constructorDeps;
                        propertyDeps = baseDeps.propertyDeps;
                    } else {
                        // Fallback: try to get dependencies from implementation class (might be empty)
                        const implDeps = getDependencies(implClass);
                        constructorDeps = implDeps.constructorDeps;
                        propertyDeps = implDeps.propertyDeps;
                    }
                    
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
 * Generate a single service implementation concurrently
 */
async function generateSingleService(
    interfaceName: string,
    declaration: InterfaceDeclaration | ClassDeclaration,
    outputDir: string,
    lockedFiles: string[],
    options: GenerateOptions,
    generatedServices: GeneratedService[]
): Promise<FileStats> {
    const fileStartTime = Date.now();
    const implName = `${interfaceName}Impl`;
    const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
    const implFilePath = path.join(outputDir, implFileName);

    try {
        if (lockedFiles.includes(path.resolve(implFilePath))) {
            console.log(`  -> SKIPPED (locked): ${implFilePath}`);
            return {
                interfaceName,
                status: 'locked',
                duration: Date.now() - fileStartTime
            };
        }
        
        // If force is used with specific files, delete only the corresponding impl file
        if (options.force && options.files.length > 0 && fs.existsSync(implFilePath)) {
            console.log(`  -> FORCE: Deleting existing file: ${implFilePath}`);
            fs.unlinkSync(implFilePath);
        }
        
        if (fs.existsSync(implFilePath) && !options.force) {
            console.log(`  -> SKIPPED: ${implFilePath} already exists. Use --force to overwrite.`);
            return {
                interfaceName,
                status: 'skipped',
                duration: Date.now() - fileStartTime
            };
        }

        console.log(`  -> Generating implementation for ${interfaceName}...`);
        const originalImportPath = path.relative(path.dirname(implFilePath), declaration.getSourceFile().getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
        
        // Step 2: Dependency Analysis
        const { dependenciesText, originalCode } = generateDependencyInfo(
            declaration,
            originalImportPath,
            implFilePath
        );

        // Step 3: Prompt Generate
        const prompt = generatePrompt(declaration, dependenciesText, originalCode, options.provider);
        
        // Step 4: Model Call
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
                // If fix failed, record error and return
                const fileDuration = Date.now() - fileStartTime;
                return {
                    interfaceName,
                    status: 'error',
                    duration: fileDuration,
                    error: `Validation failed after ${fixResult.attempts} retry attempts`
                };
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
        
        // Thread-safe push to shared array
        generatedServices.push({
            interfaceName,
            implName,
            implFilePath: `./${implFileName}`,
            constructorDependencies: constructorDeps || [],
            propertyDependencies: propertyDeps || [],
        });
        
        const fileDuration = Date.now() - fileStartTime;
        console.log(`  -> ✅ ${interfaceName} completed in ${(fileDuration / 1000).toFixed(2)}s`);
        
        return {
            interfaceName,
            status: 'generated',
            duration: fileDuration
        };
    } catch (error) {
        const fileDuration = Date.now() - fileStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  -> ❌ Failed to generate ${interfaceName}: ${errorMessage}`);
        return {
            interfaceName,
            status: 'error',
            duration: fileDuration,
            error: errorMessage
        };
    }
}

/**
 * Ensure JSDoc index exists, auto-generate if missing
 */
async function ensureJSDocIndex(verbose: boolean = false): Promise<void> {
    const projectPath = process.cwd();
    const jsdocDir = path.join(projectPath, '.jsdoc');
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    // Check if package.json exists
    if (!fs.existsSync(packageJsonPath)) {
        if (verbose) {
            console.log('[JSDoc Auto] No package.json found, skipping JSDoc indexing');
        }
        return;
    }
    
    // Check if .jsdoc directory exists and has content
    const hasExistingIndex = fs.existsSync(jsdocDir) && 
                           fs.readdirSync(jsdocDir).filter(f => f.endsWith('.json')).length > 0;
    
    if (hasExistingIndex) {
        if (verbose) {
            console.log('[JSDoc Auto] JSDoc index already exists, skipping auto-generation');
        }
        return;
    }
    
    // Auto-generate JSDoc index
    console.log('📚 JSDoc index not found, auto-generating...');
    
    try {
        const indexer = new JSDocIndexer(projectPath);
        await indexer.indexAllDependencies();
        
        const indexedLibraries = indexer.getIndexedLibraries();
        if (indexedLibraries.length > 0) {
            console.log(`✅ JSDoc auto-generation completed! Indexed ${indexedLibraries.length} libraries.`);
            if (verbose) {
                console.log('📋 Indexed libraries:', indexedLibraries.join(', '));
            }
        } else {
            console.log('ℹ️  No third-party libraries found to index.');
        }
    } catch (error) {
        console.warn('⚠️  JSDoc auto-generation failed:', error instanceof Error ? error.message : 'Unknown error');
        console.warn('   Code generation will continue without JSDoc context.');
    }
}

/**
 * Core code generation function
 */
export async function generateCode(options: GenerateOptions): Promise<GenerationResult> {
    const totalStartTime = Date.now();
    const config = getConfig();
    
    console.log(`🚀 Starting code generation at ${new Date().toLocaleTimeString()}`);
    
    // Step 0: Auto-check and generate JSDoc if needed
    await ensureJSDocIndex(options.verbose);
    
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

    // Step 2-6: Generate implementations for each unique service concurrently
    console.log(`🚀 Starting concurrent generation of ${servicesToGenerate.size} service(s)...`);
    
    // Create concurrent generation tasks
    const generationTasks = Array.from(servicesToGenerate.entries()).map(([interfaceName, { declaration, sourceFile }]) => 
        generateSingleService(
            interfaceName, 
            declaration, 
            outputDir, 
            lockedFiles, 
            options, 
            generatedServices
        )
    );
    
    // Execute all generation tasks concurrently
    const results = await Promise.allSettled(generationTasks);
    
    // Process results and collect statistics
    results.forEach((result, index) => {
        const interfaceNames = Array.from(servicesToGenerate.keys());
        const interfaceName = interfaceNames[index];
        
        if (result.status === 'fulfilled') {
            fileStats.push(result.value);
        } else {
            const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
            console.error(`  -> ❌ Failed to generate ${interfaceName || 'Unknown'}: ${errorMessage}`);
            fileStats.push({
                interfaceName: interfaceName || 'Unknown',
                status: 'error',
                duration: 0,
                error: errorMessage
            });
        }
    });
    
    // Log completion summary
    const successCount = fileStats.filter(f => f.status === 'generated').length;
    const skipCount = fileStats.filter(f => f.status === 'skipped' || f.status === 'locked').length;
    const errorCount = fileStats.filter(f => f.status === 'error').length;
    
    console.log(`\n📊 Generation Summary:`);
    console.log(`   ✅ Generated: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   🕒 Total: ${servicesToGenerate.size}`);
    
    if (successCount > 0) {
        const avgDuration = fileStats
            .filter(f => f.status === 'generated' && f.duration)
            .reduce((sum, f) => sum + (f.duration || 0), 0) / successCount;
        console.log(`   ⚡ Average generation time: ${(avgDuration / 1000).toFixed(2)}s`);
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
