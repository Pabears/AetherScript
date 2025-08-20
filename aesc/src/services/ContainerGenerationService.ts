import type { GeneratedService } from './types';

/**
 * Abstract class for a container generation service.
 * This service is responsible for generating the dependency injection
 * container code based on a list of available services.
 */
export abstract class ContainerGenerationService {
    /**
     * Generates the TypeScript code for the dependency injection container.
     * @param services An array of objects describing the services to be included in the container.
     * @returns The generated container code as a string.
     */
    abstract generateContainerCode(services: GeneratedService[]): Promise<string>;
}
