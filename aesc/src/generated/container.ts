// Service Implementations
import { LoggingServiceImpl } from './LoggingServiceImpl';
import { ConfigServiceImpl } from './ConfigServiceImpl';
import { ProviderServiceImpl } from './ProviderServiceImpl';
import { FileAnalysisServiceImpl } from './FileAnalysisServiceImpl';
import { JsdocServiceImpl } from './JsdocServiceImpl';
import { CodeGenerationServiceImpl } from './CodeGenerationServiceImpl';
import { DependencyAnalysisServiceImpl } from './DependencyAnalysisServiceImpl';
import { ServiceGenerationServiceImpl } from './ServiceGenerationServiceImpl';
import { ContainerGenerationServiceImpl } from './ContainerGenerationServiceImpl';

// Abstract Service Types
import { LoggingService } from '../services/LoggingService';
import { ConfigService } from '../services/ConfigService';
import { ProviderService } from '../services/ProviderService';
import { FileAnalysisService } from '../services/FileAnalysisService';
import { JsdocService } from '../services/JsdocService';
import { CodeGenerationService } from '../services/CodeGenerationService';
import { DependencyAnalysisService } from '../services/DependencyAnalysisService';
import { ServiceGenerationService } from '../services/ServiceGenerationService';
import { ContainerGenerationService } from '../services/ContainerGenerationService';

/**
 * The ServiceMap provides a mapping from service name to service type.
 * This is used for type-safe retrieval of services from the container.
 */
interface ServiceMap {
    LoggingService: LoggingService;
    ConfigService: ConfigService;
    ProviderService: ProviderService;
    FileAnalysisService: FileAnalysisService;
    JsdocService: JsdocService;
    CodeGenerationService: CodeGenerationService;
    DependencyAnalysisService: DependencyAnalysisService;
    ServiceGenerationService: ServiceGenerationService;
    ContainerGenerationService: ContainerGenerationService;
}

class Container {
    // A simple map to hold the singleton instances of our services.
    private readonly instances = new Map<keyof ServiceMap, any>();

    constructor() {
        this.registerServices();
    }

    private registerServices(): void {
        // Instantiate and register each service.
        // Since our current ServiceImpls don't have constructor dependencies
        // on each other, the order of instantiation doesn't matter.
        this.instances.set('LoggingService', new LoggingServiceImpl());
        this.instances.set('ConfigService', new ConfigServiceImpl());
        this.instances.set('ProviderService', new ProviderServiceImpl());
        this.instances.set('FileAnalysisService', new FileAnalysisServiceImpl());
        this.instances.set('JsdocService', new JsdocServiceImpl());
        this.instances.set('CodeGenerationService', new CodeGenerationServiceImpl());
        this.instances.set('DependencyAnalysisService', new DependencyAnalysisServiceImpl());
        this.instances.set('ServiceGenerationService', new ServiceGenerationServiceImpl());
        this.instances.set('ContainerGenerationService', new ContainerGenerationServiceImpl());
    }

    /**
     * Retrieves a service instance from the container.
     * @param identifier The name of the service to retrieve.
     * @returns The singleton instance of the service.
     */
    public get<K extends keyof ServiceMap>(identifier: K): ServiceMap[K] {
        const instance = this.instances.get(identifier);
        if (!instance) {
            throw new Error(`Service not found for identifier: ${identifier}`);
        }
        return instance;
    }
}

/**
 * The singleton container instance for the entire application.
 */
export const container = new Container();
