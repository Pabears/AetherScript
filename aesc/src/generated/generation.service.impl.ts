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
import { PostProcessorService } from '../services/post-processor-service';
import { generatePrompt } from '../prompts/implementation';

/**
 * @class GenerationServiceImpl
 * @description
 * Concrete implementation of the GenerationService.
 * It orchestrates the entire code generation process, from file analysis to DI container creation.
 */
import type { PipelineContext, PipelineStage } from '../services/pipeline.service';

class InitializePipelineStage implements PipelineStage {
    constructor(private loggingService: LoggingService, private configService: ConfigService, private fileUtilsService: FileUtilsService, private lockManagerService: LockManagerService, private fileAnalysisService: FileAnalysisService) {}

    async execute(context: PipelineContext): Promise<PipelineContext> {
        this.loggingService.info(`🚀 Starting code generation at ${new Date().toLocaleTimeString()}`);
        const config = this.configService.getConfig();
        const outputDir = path.join(process.cwd(), config.outputDir);
        const shouldClean = context.options.force && context.options.files.length === 0;
        this.fileUtilsService.ensureOutputDirectory(outputDir, shouldClean);

        context.outputDir = outputDir;
        context.lockedFiles = this.lockManagerService.getLockedFiles();
        context.servicesToGenerate = this.fileAnalysisService.analyzeSourceFiles(context.project, context.options.files);
        
        this.loggingService.info("Scanning for @AutoGen decorators...");
        this.loggingService.info(`📋 Found ${context.servicesToGenerate.size} service(s) to generate`);

        return context;
    }
}

class JSDocIndexStage implements PipelineStage {
    constructor(private loggingService: LoggingService, private jsdocService: JSDocService) {}

    async execute(context: PipelineContext): Promise<PipelineContext> {
        await this.ensureJSDocIndex(context.options.verbose);
        return context;
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
}

class ServiceGenerationStage implements PipelineStage {
    constructor(
        private generationService: GenerationServiceImpl
    ) {}

    async execute(context: PipelineContext): Promise<PipelineContext> {
        this.generationService.loggingService.info(`🚀 Starting sequential generation of ${context.servicesToGenerate.size} service(s)...`);

        for (const [interfaceName, { declaration }] of context.servicesToGenerate.entries()) {
            const fileStat = await this.generationService.generateSingleService(interfaceName, declaration, context);
            context.fileStats.push(fileStat);
        }

        const summary = this.generationService.statisticsService.generateSummary(context.fileStats);
        this.generationService.loggingService.info(`
📊 Generation Summary: Generated: ${summary.generated}, Skipped: ${summary.skipped}, Locked: ${summary.locked}, Errors: ${summary.errors}`);

        return context;
    }
}

class DIContainerStage implements PipelineStage {
    constructor(private generationService: GenerationServiceImpl) {}

    async execute(context: PipelineContext): Promise<PipelineContext> {
        const summary = this.generationService.statisticsService.generateSummary(context.fileStats);
        const containerNeedsUpdate = summary.generated > 0 || (context.options.force && context.options.files.length === 0);

        if (containerNeedsUpdate) {
            this.generationService.loggingService.info("\nGenerating DI container...");
            const allServices = await this.generationService.getAllExistingServices(context.outputDir, context.project, context.generatedServices);

            if (allServices.length > 0) {
                await this.generationService.generateContainer(context.outputDir, allServices);
                this.generationService.loggingService.info(`DI container generated successfully with ${allServices.length} services.`);
            } else {
                this.generationService.loggingService.info("No services found to register in container.");
            }
        } else if (context.servicesToGenerate.size > 0) {
            this.generationService.loggingService.info("\nSkipping DI container generation as no new services were generated.");
        }

        return context;
    }
}

export class GenerationServiceImpl extends GenerationService {
    // Injected services
    // Injected services
    public configService: ConfigService;
    public jsdocService: JSDocService;
    public fileUtilsService: FileUtilsService;
    public lockManagerService: LockManagerService;
    public fileAnalysisService: FileAnalysisService;
    public loggingService: LoggingService;
    public statisticsService: StatisticsService;
    public modelCallerService: ModelCallerService;
    public dependencyAnalysisService: DependencyAnalysisService;
    public postProcessorService: PostProcessorService;

    constructor(
        configService: ConfigService,
        jsdocService: JSDocService,
        fileUtilsService: FileUtilsService,
        lockManagerService: LockManagerService,
        fileAnalysisService: FileAnalysisService,
        loggingService: LoggingService,
        statisticsService: StatisticsService,
        modelCallerService: ModelCallerService,
        dependencyAnalysisService: DependencyAnalysisService,
        postProcessorService: PostProcessorService
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
        this.postProcessorService = postProcessorService;
    }

    public async generate(options: GenerateOptions): Promise<GenerationResult> {
        let context: PipelineContext = {
            project: new Project({ tsConfigFilePath: "tsconfig.json" }),
            options,
            outputDir: '',
            lockedFiles: [],
            servicesToGenerate: new Map(),
            generatedServices: [],
            fileStats: [],
            totalStartTime: Date.now(),
        };

        const pipeline: PipelineStage[] = [
            new InitializePipelineStage(this.loggingService, this.configService, this.fileUtilsService, this.lockManagerService, this.fileAnalysisService),
            new JSDocIndexStage(this.loggingService, this.jsdocService),
            new ServiceGenerationStage(this),
            new DIContainerStage(this),
        ];

        for (const stage of pipeline) {
            context = await stage.execute(context);
        }

        const totalDuration = Date.now() - context.totalStartTime;
        const summary = this.statisticsService.generateSummary(context.fileStats);
        
        return { 
            success: summary.errors === 0, 
            fileStats: context.fileStats, 
            totalDuration, 
            generatedServices: context.generatedServices 
        };
    }

    public async generateSingleService(
        interfaceName: string, declaration: InterfaceDeclaration | ClassDeclaration, context: PipelineContext
    ): Promise<FileStats> {
        const fileStartTime = Date.now();
        const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
        const implFilePath = path.join(context.outputDir, implFileName);

        try {
            if (context.lockedFiles.includes(path.resolve(implFilePath))) {
                this.loggingService.info(`  -> SKIPPED (locked): ${implFilePath}`);
                return { interfaceName, status: 'locked', duration: Date.now() - fileStartTime };
            }

            if (context.options.force && context.options.files.length > 0 && fs.existsSync(implFilePath)) {
                this.loggingService.info(`  -> FORCE: Deleting existing file: ${implFilePath}`);
                fs.unlinkSync(implFilePath);
            }

            if (fs.existsSync(implFilePath) && !context.options.force) {
                this.loggingService.info(`  -> SKIPPED: ${implFilePath} already exists. Use --force to overwrite.`);
                return { interfaceName, status: 'skipped', duration: Date.now() - fileStartTime };
            }

            this.loggingService.info(`  -> Generating implementation for ${interfaceName}...`);
                        const originalImportPath = path.relative(path.dirname(implFilePath), declaration.getSourceFile().getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');

            const { dependenciesText, originalCode } = await this.dependencyAnalysisService.getDependencyInfo(declaration, implFilePath);
            const prompt = generatePrompt(declaration, dependenciesText, originalCode, context.options.provider);
            const rawResponse = await this.modelCallerService.callModel(prompt, interfaceName, context.options.model, context.options.verbose, context.options.provider);
            let processedCode = this.postProcessorService.postProcessGeneratedCode(rawResponse, declaration, implFilePath);

            let { isValid, errors } = await this.postProcessorService.validateGeneratedCode(processedCode, declaration, implFilePath);
            if (!isValid) {
                const fixResult = await this.postProcessorService.fixGeneratedCode(processedCode, declaration, implFilePath, originalImportPath, interfaceName, errors, context.options.model, context.options.verbose, context.options.provider);
                if (fixResult.success && fixResult.fixedCode) {
                    processedCode = fixResult.fixedCode;
                } else {
                    throw new Error(`Validation failed after ${fixResult.attempts} retry attempts`);
                }
            }

            this.fileUtilsService.saveGeneratedFile(implFilePath, processedCode);

            const { constructorDeps, propertyDeps } = Node.isClassDeclaration(declaration) ? this.fileAnalysisService.getDependencies(declaration as any) : { constructorDeps: [], propertyDeps: [] };
            context.generatedServices.push({ interfaceName, implName: `${interfaceName}Impl`, implFilePath: `./${implFileName}`, constructorDependencies: constructorDeps, propertyDependencies: propertyDeps });

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

    public async generateContainer(outputDir: string, services: GeneratedService[]): Promise<void> {
        // Extract the actual class name from interface name
        // Use the original interface/class name as service identifier (e.g., "DB", "ProductService", "CacheService")
        const normalizeServiceId = (interfaceName: string): string => {
            // Simply return the interface name as-is since it's already the correct class name
            // Examples: "DB" -> "DB", "ProductService" -> "ProductService", "CacheService" -> "CacheService"
            return interfaceName;
        };
    
        // Helper function to extract interface name from type string and normalize it
        const extractInterfaceName = (typeStr: string): string => {
            // Handle types like "import(\"/path/to/file\").InterfaceName" or "InterfaceName"
            if (typeStr.includes('import(')) {
                // Extract from import("..." ).InterfaceName
                const match = typeStr.match(/\)\.([A-Za-z_][A-Za-z0-9_]*)$/);
                const rawName = match?.[1] || typeStr;
                return normalizeServiceId(rawName);
            }
            // Handle simple interface names
            return normalizeServiceId(typeStr);
        };
    
        // Deduplicate services by normalized interface name to prevent duplicate definitions
        const uniqueServices = services.reduce((acc, service) => {
            const normalizedName = normalizeServiceId(service.interfaceName);
            const existingIndex = acc.findIndex(s => normalizeServiceId(s.interfaceName) === normalizedName);
            if (existingIndex >= 0) {
                // Replace with newer service definition (in case of updates)
                acc[existingIndex] = service;
            } else {
                acc.push(service);
            }
            return acc;
        }, [] as GeneratedService[]);
        
        this.loggingService.info(`[Container] Generating container with ${uniqueServices.length} unique services (deduplicated from ${services.length} total)`);
        
        // Generate imports using normalized service names
        const imports = uniqueServices.map(s => {
            const normalizedPath = s.implFilePath.replace(/\\/g, '/').replace(/\.ts$/, '');
            return `import { ${s.implName} } from '${normalizedPath}';`;
        }).join('\n');
    
        // Generate type mappings using normalized service identifiers
        const typeMappings = uniqueServices.map(s => {
            const serviceId = normalizeServiceId(s.interfaceName);
            return `    '${serviceId}': ${s.implName};`;
        }).join('\n');
    
        const factoryMappings = uniqueServices.map(s => {
            const serviceId = normalizeServiceId(s.interfaceName);
            this.loggingService.info(`[Container] Processing service: ${serviceId}`);
            this.loggingService.info(`[Container] Property dependencies: ${JSON.stringify(s.propertyDependencies)}`);
            
            let factoryCode = `        '${serviceId}': () => {\n`;
            factoryCode += `            const instance = new ${s.implName}();\n`;
            
            s.propertyDependencies.forEach(dep => {
                const depInterfaceName = extractInterfaceName(dep.type);
                this.loggingService.info(`[Container] Adding dependency injection: instance.${dep.name} = this.get('${depInterfaceName}')`);
                factoryCode += `            instance.${dep.name} = this.get('${depInterfaceName}');\n`;
            });
            
            factoryCode += `            return instance;\n`;
            factoryCode += `        }`;
            
            this.loggingService.info(`[Container] Generated factory code for ${serviceId}:`);
            this.loggingService.info(factoryCode);
            
            return factoryCode;
        }).join(',\n');
    
        // Generate container code using template configuration
        const generateContainerTemplate = () => {
            const timestamp = new Date().toISOString();
            const errorMessage = 'Service not found for identifier: ';
            
            return {
                header: `// Generated by AutoGen at ${timestamp}`,
                imports,
                serviceMapInterface: {
                    name: 'ServiceMap',
                    mappings: typeMappings
                },
                containerClass: {
                    name: 'Container',
                    instancesField: 'private instances: Map<keyof ServiceMap, any> = new Map();',
                    factoriesField: 'private factories: { [K in keyof ServiceMap]: () => ServiceMap[K] };',
                    constructor: {
                        factoryMappings
                    },
                    getMethod: {
                        name: 'get',
                        signature: 'public get<K extends keyof ServiceMap>(identifier: K): ServiceMap[K]',
                        errorMessage
                    }
                },
                exportStatement: 'export const container = new Container();'
            };
        };
    
        const template = generateContainerTemplate();
        
        const containerCode = `${template.header}\n${template.imports}\n\ninterface ${template.serviceMapInterface.name} {\n${template.serviceMapInterface.mappings}\n}\n\nclass ${template.containerClass.name} {\n    ${template.containerClass.instancesField}\n\n    ${template.containerClass.factoriesField}\n\n    constructor() {\n        this.factories = {\n${template.containerClass.constructor.factoryMappings}\n        };\n    }\n\n    ${template.containerClass.getMethod.signature} {\n        if (!this.instances.has(identifier)) {\n            const factory = this.factories[identifier];
            if (!factory) {
                throw new Error('${template.containerClass.getMethod.errorMessage}' + identifier);
            }
            const instance = factory();
            this.instances.set(identifier, instance);
        }
        return this.instances.get(identifier) as ServiceMap[K];\n    }\n}\n\n${template.exportStatement}\n`;
    
        const outputPath = path.join(outputDir, 'container.ts');
        fs.writeFileSync(outputPath, containerCode);
    }

    public async ensureJSDocIndex(verbose: boolean): Promise<void> {
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

    public async getAllExistingServices(outputDir: string, project: Project, newlyGenerated: GeneratedService[]): Promise<GeneratedService[]> {
        const allServices = new Map<string, GeneratedService>();

        // Add newly generated services first, they have priority
        for (const service of newlyGenerated) {
            allServices.set(service.interfaceName, service);
        }

        if (!fs.existsSync(outputDir)) {
            return Array.from(allServices.values());
        }

        const implFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.service.impl.ts'));
        const tempProject = new Project({ tsConfigFilePath: "tsconfig.json" }); // Use a temporary, isolated project

        for (const file of implFiles) {
            const filePath = path.join(outputDir, file);
            try {
                const sourceFile = tempProject.addSourceFileAtPath(filePath);
                const implClass = sourceFile.getClasses()[0];
                if (implClass) {
                    const implementsClause = implClass.getImplements()[0];
                    if (implementsClause) {
                        const interfaceName = implementsClause.getExpression().getText();
                        // Only add if not already present from the 'newlyGenerated' list
                        if (!allServices.has(interfaceName)) {
                            const { constructorDeps, propertyDeps } = this.fileAnalysisService.getDependencies(implClass);
                            allServices.set(interfaceName, {
                                interfaceName,
                                implName: implClass.getName() || '',
                                implFilePath: `./${file}`,
                                constructorDependencies: constructorDeps,
                                propertyDependencies: propertyDeps
                            });
                        }
                    }
                }
                // IMPORTANT: remove the file from the temp project to avoid issues
                tempProject.removeSourceFile(sourceFile);
            } catch (error) {
                this.loggingService.warn(`Could not analyze existing service ${file}: ${error}`);
            }
        }

        return Array.from(allServices.values());
    }

}