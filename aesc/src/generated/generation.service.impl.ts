import { Project, Node, InterfaceDeclaration, ClassDeclaration, ts } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { GenerationService } from '../services/generation-service';
import type { GenerateOptions, GenerationResult, FileStats, GeneratedService } from '../types';
import { ConfigService } from '../services/config-service';
import { JSDocService } from '../services/jsdoc-service';
import { FileUtilsService } from '../services/file-utils-service';
import { LockManagerService } from '../services/lock-manager-service';
import { FileAnalysisService } from '../services/file-analysis-service';
import { DependencyAnalysisService } from '../services/dependency-analysis-service';
import { LoggingService } from '../services/logging-service';
import { StatisticsService } from '../services/statistics-service';
import { ModelCallerService } from '../services/model-caller-service';
import { JSDocIndexer } from '../jsdoc/indexer';
import { JSDocFormatter } from '../jsdoc/formatter';
import { generatePrompt } from '../prompts/implementation';
import { cleanGeneratedCode } from '../generation/code-cleaner';
import { postProcessGeneratedCode, validateGeneratedCode } from '../generation/post-processor';
import { fixGeneratedCode } from '../generation/code-fixer';

/**
 * @class GenerationServiceImpl
 * @description
 * Concrete implementation of the GenerationService.
 * It orchestrates the entire code generation process, from file analysis to DI container creation.
 */
export class GenerationServiceImpl extends GenerationService {
    // Injected services
    private configService: ConfigService;
    private jsdocService: JSDocService;
    private fileUtilsService: FileUtilsService;
    private lockManagerService: LockManagerService;
    private fileAnalysisService: FileAnalysisService;
    private loggingService: LoggingService;
    private statisticsService: StatisticsService;
    private modelCallerService: ModelCallerService;
    private dependencyAnalysisService: DependencyAnalysisService;

    constructor(
        configService: ConfigService,
        jsdocService: JSDocService,
        fileUtilsService: FileUtilsService,
        lockManagerService: LockManagerService,
        fileAnalysisService: FileAnalysisService,
        loggingService: LoggingService,
        statisticsService: StatisticsService,
        modelCallerService: ModelCallerService,
        dependencyAnalysisService: DependencyAnalysisService
    ) {
        super();
        this.configService = configService;
        this.jsdocService = jsdocService;
        this.fileUtilsService = fileUtilsService;
        this.lockManagerService = lockManagerService;
        this.fileAnalysisService = fileAnalysisService;
        this.loggingService = loggingService;
        this.statisticsService = statisticsService;
        this.modelCallerService = modelCallerService;
        this.dependencyAnalysisService = dependencyAnalysisService;
    }

    public async generate(options: GenerateOptions): Promise<GenerationResult> {
        const totalStartTime = Date.now();
        const config = this.configService.getConfig();

        this.loggingService.info(`🚀 Starting code generation at ${new Date().toLocaleTimeString()}`);

        await this.ensureJSDocIndex(options.verbose);

        const project = new Project({ tsConfigFilePath: "tsconfig.json" });
        const outputDir = path.join(process.cwd(), config.outputDir);

        const shouldClean = options.force && options.files.length === 0;
        this.fileUtilsService.ensureOutputDirectory(outputDir, shouldClean);

        const lockedFiles = this.lockManagerService.getLockedFiles();
        const generatedServices: GeneratedService[] = [];

        this.loggingService.info("Scanning for @AutoGen decorators...");
        const servicesToGenerate = this.fileAnalysisService.analyzeSourceFiles(project, options.files);
        this.loggingService.info(`📋 Found ${servicesToGenerate.size} service(s) to generate`);

        const fileStats: FileStats[] = [];
        this.loggingService.info(`🚀 Starting concurrent generation of ${servicesToGenerate.size} service(s)...`);

        const generationTasks = Array.from(servicesToGenerate.entries()).map(([interfaceName, { declaration }]) =>
            this.generateSingleService(interfaceName, declaration, outputDir, lockedFiles, options, generatedServices)
        );

        const results = await Promise.allSettled(generationTasks);

        results.forEach((result, index) => {
            const interfaceName = Array.from(servicesToGenerate.keys())[index];
            if (!interfaceName) {
                this.loggingService.error(`-> ❌ Failed to generate service at index ${index}: Unknown interface name`);
                return;
            }

            if (result.status === 'fulfilled') {
                fileStats.push(result.value);
            } else {
                const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
                this.loggingService.error(`-> ❌ Failed to generate ${interfaceName}: ${error}`);
                fileStats.push({ interfaceName, status: 'error', duration: 0, error });
            }
        });

        const summary = this.statisticsService.generateSummary(fileStats);
        this.loggingService.info(`\n📊 Generation Summary: Generated: ${summary.generated}, Skipped: ${summary.skipped}, Locked: ${summary.locked}, Errors: ${summary.errors}`);

        this.loggingService.info("\nGenerating DI container...");
        const allServices = await this.getAllExistingServices(outputDir, project, generatedServices);

        if (allServices.length > 0) {
            await this.generateContainer(outputDir, allServices);
            this.loggingService.info(`DI container generated successfully with ${allServices.length} services.`);
        } else {
            this.loggingService.info("No services found to register in container.");
        }

        const totalDuration = Date.now() - totalStartTime;
        return { success: summary.errors === 0, fileStats, totalDuration, generatedServices: allServices };
    }

    private async generateSingleService(
        interfaceName: string, declaration: InterfaceDeclaration | ClassDeclaration, outputDir: string,
        lockedFiles: string[], options: GenerateOptions, generatedServices: GeneratedService[]
    ): Promise<FileStats> {
        const fileStartTime = Date.now();
        const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
        const implFilePath = path.join(outputDir, implFileName);

        try {
            if (lockedFiles.includes(path.resolve(implFilePath))) {
                this.loggingService.info(`  -> SKIPPED (locked): ${implFilePath}`);
                return { interfaceName, status: 'locked', duration: Date.now() - fileStartTime };
            }

            if (options.force && options.files.length > 0 && fs.existsSync(implFilePath)) {
                this.loggingService.info(`  -> FORCE: Deleting existing file: ${implFilePath}`);
                fs.unlinkSync(implFilePath);
            }

            if (fs.existsSync(implFilePath) && !options.force) {
                this.loggingService.info(`  -> SKIPPED: ${implFilePath} already exists. Use --force to overwrite.`);
                return { interfaceName, status: 'skipped', duration: Date.now() - fileStartTime };
            }

            this.loggingService.info(`  -> Generating implementation for ${interfaceName}...`);
            const originalImportPath = path.relative(path.dirname(implFilePath), declaration.getSourceFile().getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');

            const { dependenciesText, originalCode } = await this.dependencyAnalysisService.getDependencyInfo(declaration, implFilePath);
            const prompt = generatePrompt(declaration, dependenciesText, originalCode, options.provider);
            const rawResponse = await this.modelCallerService.callModel(prompt, interfaceName, options.model, options.verbose, options.provider);
            const cleanedCode = cleanGeneratedCode(rawResponse, interfaceName, options.verbose);
            let processedCode = postProcessGeneratedCode(cleanedCode, declaration, implFilePath);

            let { isValid, errors } = await validateGeneratedCode(processedCode, declaration, implFilePath);
            if (!isValid) {
                const fixResult = await fixGeneratedCode(processedCode, declaration, implFilePath, originalImportPath, interfaceName, errors, options.model, options.verbose, options.provider);
                if (fixResult.success && fixResult.fixedCode) {
                    processedCode = fixResult.fixedCode;
                } else {
                    throw new Error(`Validation failed after ${fixResult.attempts} retry attempts`);
                }
            }

            this.fileUtilsService.saveGeneratedFile(implFilePath, processedCode);

            const { constructorDeps, propertyDeps } = Node.isClassDeclaration(declaration) ? this.fileAnalysisService.getDependencies(declaration as any) : { constructorDeps: [], propertyDeps: [] };
            generatedServices.push({ interfaceName, implName: `${interfaceName}Impl`, implFilePath: `./${implFileName}`, constructorDependencies: constructorDeps, propertyDependencies: propertyDeps });

            const duration = Date.now() - fileStartTime;
            this.loggingService.info(`  -> ✅ ${interfaceName} completed in ${(duration / 1000).toFixed(2)}s`);
            return { interfaceName, status: 'generated', duration };
        } catch (error) {
            const duration = Date.now() - fileStartTime;
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.loggingService.error(`  -> ❌ Failed to generate ${interfaceName}: ${message}`);
            return { interfaceName, status: 'error', duration, error: message };
        }
    }

    private async generateContainer(outputDir: string, services: GeneratedService[]): Promise<void> {
        const uniqueServices = services.reduce((acc, service) => {
            if (!acc.some(s => s.interfaceName === service.interfaceName)) acc.push(service);
            return acc;
        }, [] as GeneratedService[]);

        const imports = uniqueServices.map(s => `import { ${s.implName} } from '${s.implFilePath.replace(/\\/g, '/').replace(/\.ts$/, '')}';`).join('\n');
        const typeMappings = uniqueServices.map(s => `    '${s.interfaceName}': ${s.implName};`).join('\n');
        const factoryMappings = uniqueServices.map(s => {
            const constructorArgs = s.constructorDependencies.map(dep => `this.get('${dep}')`).join(', ');
            let factoryCode = `        '${s.interfaceName}': () => {\n`;
            factoryCode += `            const instance = new ${s.implName}(${constructorArgs});\n`;
            s.propertyDependencies.forEach(dep => {
                const depInterfaceName = dep.type.includes('import(') ? dep.type.match(/\)\.([A-Za-z_][A-Za-z0-9_]*)$/)?.[1] || dep.type : dep.type;
                factoryCode += `            instance.${dep.name} = this.get('${depInterfaceName}');\n`;
            });
            factoryCode += `            return instance;\n        }`;
            return factoryCode;
        }).join(',\n');

        const containerCode = `// Generated by AutoGen at ${new Date().toISOString()}\n${imports}\n\ninterface ServiceMap {\n${typeMappings}\n}\n\nclass Container {\n    private instances: Map<keyof ServiceMap, any> = new Map();\n    private factories: { [K in keyof ServiceMap]: () => ServiceMap[K] };\n\n    constructor() {\n        this.factories = {\n${factoryMappings}\n        };\n    }\n\n    public get<K extends keyof ServiceMap>(identifier: K): ServiceMap[K] {\n        if (!this.instances.has(identifier)) {\n            const factory = this.factories[identifier];\n            if (!factory) throw new Error('Service not found: ' + identifier);\n            this.instances.set(identifier, factory());\n        }\n        return this.instances.get(identifier) as ServiceMap[K];\n    }\n}\n\nexport const container = new Container();\n`;

        fs.writeFileSync(path.join(outputDir, 'container.ts'), containerCode);
    }

    private async ensureJSDocIndex(verbose: boolean): Promise<void> {
        const projectPath = process.cwd();
        const jsdocDir = path.join(projectPath, '.jsdoc');
        if (fs.existsSync(jsdocDir) && fs.readdirSync(jsdocDir).length > 0) {
            if (verbose) this.loggingService.info('[JSDoc Auto] JSDoc index already exists.');
            return;
        }
        this.loggingService.info('📚 JSDoc index not found, auto-generating...');
        try {
            await this.jsdocService.indexAllDependencies();
            const indexed = await this.jsdocService.getIndexedLibraries();
            if (indexed.length > 0) {
                this.loggingService.info(`✅ JSDoc auto-generation completed! Indexed ${indexed.length} libraries.`);
            } else {
                this.loggingService.info('ℹ️  No third-party libraries found to index.');
            }
        } catch (error) {
            this.loggingService.warn('⚠️  JSDoc auto-generation failed:', error instanceof Error ? error.message : 'Unknown error');
        }
    }

    private async getAllExistingServices(outputDir: string, project: Project, newlyGenerated: GeneratedService[]): Promise<GeneratedService[]> {
        const allServices = [...newlyGenerated];
        if (!fs.existsSync(outputDir)) return allServices;

        const implFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.service.impl.ts'));
        for (const file of implFiles) {
            const interfaceName = path.basename(file, '.service.impl.ts').split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
            if (newlyGenerated.some(s => s.interfaceName === interfaceName)) continue;

            try {
                const sourceFile = project.addSourceFileAtPath(path.join(outputDir, file));
                const implClass = sourceFile.getClasses()[0];
                if (implClass) {
                    const { constructorDeps, propertyDeps } = this.fileAnalysisService.getDependencies(implClass);
                    allServices.push({ interfaceName, implName: implClass.getName() || '', implFilePath: `./${file}`, constructorDependencies: constructorDeps, propertyDependencies: propertyDeps });
                }
            } catch (error) {
                this.loggingService.warn(`Could not analyze existing service ${file}: ${error}`);
            }
        }
        return allServices;
    }

}
