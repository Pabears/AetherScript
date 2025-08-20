// Import all service interfaces
import type { ConfigService } from '../services/config-service';
import type { LoggingService } from '../services/logging-service';
import type { FileUtilsService } from '../services/file-utils-service';
import type { LockManagerService } from '../services/lock-manager-service';
import type { StatisticsService } from '../services/statistics-service';
import type { ProviderFactoryService } from '../services/provider-factory-service';
import type { JSDocService } from '../services/jsdoc-service';
import type { FileAnalysisService } from '../services/file-analysis-service';
import type { DependencyAnalysisService } from '../services/dependency-analysis-service';
import type { ModelCallerService } from '../services/model-caller-service';
import type { GenerationService } from '../services/generation-service';
import type { CommandService } from '../services/command-service';

// Import all service implementations
import { ConfigServiceImpl } from './config.service.impl';
import { LoggingServiceImpl } from './logging.service.impl';
import { FileUtilsServiceImpl } from './file-utils.service.impl';
import { LockManagerServiceImpl } from './lock-manager.service.impl';
import { StatisticsServiceImpl } from './statistics.service.impl';
import { ProviderFactoryServiceImpl } from './provider-factory.service.impl';
import { JSDocServiceImpl } from './jsdoc.service.impl';
import { FileAnalysisServiceImpl } from './file-analysis.service.impl';
import { DependencyAnalysisServiceImpl } from './dependency-analysis.service.impl';
import { ModelCallerServiceImpl } from './model-caller.service.impl';
import { GenerationServiceImpl } from './generation.service.impl';
import { CommandServiceImpl } from './command.service.impl';

/**
 * @class AppContainer
 * @description
 * A simple Inversion of Control (IoC) container for managing service instances.
 * This container is responsible for instantiating all services and will be used
 * to handle dependency injection in a central location.
 */
export class AppContainer {
    // Service properties
    public readonly configService: ConfigService;
    public readonly loggingService: LoggingService;
    public readonly fileUtilsService: FileUtilsService;
    public readonly lockManagerService: LockManagerService;
    public readonly statisticsService: StatisticsService;
    public readonly providerFactoryService: ProviderFactoryService;
    public readonly jsdocService: JSDocService;
    public readonly fileAnalysisService: FileAnalysisService;
    public readonly dependencyAnalysisService: DependencyAnalysisService;
    public readonly modelCallerService: ModelCallerService;
    public readonly generationService: GenerationService;
    public readonly commandService: CommandService;

    constructor() {
        // Services with no dependencies are instantiated first.
        this.configService = new ConfigServiceImpl();
        this.loggingService = new LoggingServiceImpl();
        this.fileUtilsService = new FileUtilsServiceImpl();
        this.lockManagerService = new LockManagerServiceImpl();
        this.statisticsService = new StatisticsServiceImpl();
        this.providerFactoryService = new ProviderFactoryServiceImpl();
        this.jsdocService = new JSDocServiceImpl();
        this.fileAnalysisService = new FileAnalysisServiceImpl();
        this.generationService = new GenerationServiceImpl();

        // Services with dependencies
        this.dependencyAnalysisService = new DependencyAnalysisServiceImpl(this.jsdocService);
        this.modelCallerService = new ModelCallerServiceImpl(this.providerFactoryService);

        // CommandService depends on other services, so it's instantiated last,
        // injecting the other service instances.
        this.commandService = new CommandServiceImpl(
            this.generationService,
            this.jsdocService,
            this.providerFactoryService,
            this.statisticsService
        );
    }
}

// Export a singleton instance of the container
export const container = new AppContainer();
