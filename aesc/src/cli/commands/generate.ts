import type { GenerateOptions, GeneratedService, FileStats } from '../../services/types';
import { container } from '../../generated/container';
import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { ensureOutputDirectory } from '../../utils/file-utils';
import { getLockData } from '../../core/lock-manager';
import { printGenerationStatistics } from '../../core/statistics';

/**
 * Handle the generate command using the new service-oriented architecture.
 */
export async function handleGenerate(options: GenerateOptions): Promise<void> {
    const loggingService = container.get('LoggingService');
    const configService = container.get('ConfigService');
    const jsdocService = container.get('JsdocService');
    const fileAnalysisService = container.get('FileAnalysisService');
    const serviceGenerationService = container.get('ServiceGenerationService');
    const containerGenerationService = container.get('ContainerGenerationService');

    try {
        const totalStartTime = Date.now();
        const config = configService.getConfig();

        loggingService.info(`🚀 Starting code generation at ${new Date().toLocaleTimeString()}`);

        // Step 0: Auto-check and generate JSDoc if needed
        await ensureJSDocIndex(options.verbose);

        const project = new Project({
            tsConfigFilePath: "tsconfig.json",
        });

        const outputDir = path.join(process.cwd(), config.outputDir);

        const shouldCleanEntireDirectory = options.force && options.files.length === 0;
        ensureOutputDirectory(outputDir, shouldCleanEntireDirectory);
        const lockedFiles = getLockData();

        loggingService.info("Scanning for @AutoGen decorators...");
        const servicesToGenerate = fileAnalysisService.analyzeSourceFiles(project, options.files);
        loggingService.info(`📋 Found ${servicesToGenerate.size} service(s) to generate`);

        const generatedServices: GeneratedService[] = [];
        const fileStats: FileStats[] = [];

        loggingService.info(`🚀 Starting concurrent generation of ${servicesToGenerate.size} service(s)...`);

        const generationTasks = Array.from(servicesToGenerate.entries()).map(([interfaceName, { declaration }]) =>
            serviceGenerationService.generateSingleService(
                interfaceName,
                declaration,
                outputDir,
                lockedFiles,
                options,
                generatedServices
            )
        );

        const results = await Promise.allSettled(generationTasks);

        results.forEach((result, index) => {
            const interfaceName = Array.from(servicesToGenerate.keys())[index];
            if (result.status === 'fulfilled') {
                fileStats.push(result.value);
            } else {
                const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
                loggingService.error(`Failed to generate ${interfaceName || 'Unknown'}`, 'Generator', { error: errorMessage });
                fileStats.push({ interfaceName: interfaceName || 'Unknown', status: 'error', duration: 0, error: errorMessage });
            }
        });

        const generationResult = {
            success: fileStats.every(f => f.status !== 'error'),
            fileStats,
            totalDuration: Date.now() - totalStartTime,
            generatedServices: []
        };
        printGenerationStatistics(generationResult, options.verbose);

        loggingService.info("\nGenerating DI container...");
        
        const allServices = await serviceGenerationService.getAllExistingServices(outputDir, project, generatedServices);
        
        if (allServices.length > 0) {
            const containerCode = await containerGenerationService.generateContainerCode(allServices);
            fs.writeFileSync(path.join(outputDir, 'container.ts'), containerCode);
            loggingService.info(`DI container generated successfully with ${allServices.length} services.`);
        } else {
            loggingService.info("No services found to register in container.");
        }

        if (!generationResult.success) {
            process.exit(1);
        }

    } catch (error) {
        loggingService.error('Generation failed', 'CLI', { error: error instanceof Error ? error.message : 'Unknown error' });
        process.exit(1);
    }
}

/**
 * Ensures JSDoc index exists, auto-generating if missing.
 * This is a helper function that uses the new JsdocService.
 */
async function ensureJSDocIndex(verbose: boolean = false): Promise<void> {
    const jsdocService = container.get('JsdocService');
    const loggingService = container.get('LoggingService');

    const projectPath = process.cwd();
    const jsdocDir = path.join(projectPath, '.jsdoc');
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        if (verbose) loggingService.debug('No package.json found, skipping JSDoc indexing.', 'JSDoc');
        return;
    }

    const hasExistingIndex = fs.existsSync(jsdocDir) && fs.readdirSync(jsdocDir).filter(f => f.endsWith('.json')).length > 0;

    if (hasExistingIndex) {
        if (verbose) loggingService.debug('JSDoc index already exists, skipping auto-generation.', 'JSDoc');
        return;
    }

    loggingService.info('📚 JSDoc index not found, auto-generating...');

    try {
        await jsdocService.indexAllDependencies();
        loggingService.info('✅ JSDoc auto-generation completed!');
    } catch (error) {
        loggingService.warn('JSDoc auto-generation failed.', 'JSDoc', { error: error instanceof Error ? error.message : 'Unknown error' });
        loggingService.warn('Code generation will continue without JSDoc context.', 'JSDoc');
    }
}
