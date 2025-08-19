import { Project, Node, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import * as path from 'path';
import * as fs from 'fs';

// Import workflow modules
import { analyzeSourceFiles, type GeneratedService } from '../file-analysis';
import { ensureOutputDirectory } from '../utils/file-utils';
import { getLockData } from './lock-manager';
import { generateContainer } from './container-generator';
import { generateSingleService, getAllExistingServices } from './service-generator';
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
