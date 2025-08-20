import type {
    CodeProject,
    GeneratedService,
    GenerateOptions,
    FileStats,
    InterfaceDeclaration,
    ClassDeclaration
} from './types';

/**
 * Abstract class for a service generation service.
 * This service is responsible for orchestrating the generation of
 * a single service implementation from its abstract definition.
 */
export abstract class ServiceGenerationService {
    /**
     * Scans for all existing service implementation files and combines them
     * with a list of newly generated services.
     * @param outputDir The directory where generated services are located.
     * @param project The ts-morph project instance.
     * @param newlyGeneratedServices An array of services that have just been generated.
     * @returns A promise that resolves with a combined list of all existing and new services.
     */
    abstract getAllExistingServices(
        outputDir: string,
        project: CodeProject,
        newlyGeneratedServices: GeneratedService[]
    ): Promise<GeneratedService[]>;

    /**
     * Generates a single service implementation.
     * This method orchestrates the entire workflow from dependency analysis to file saving.
     * @param interfaceName The name of the interface to implement.
     * @param declaration The declaration of the interface or abstract class.
     * @param outputDir The directory to output the generated file to.
     * @param lockedFiles A list of files that should not be overwritten.
     * @param options Generation options from the CLI.
     * @param generatedServices A shared array to which the details of the generated service will be pushed.
     * @returns A promise that resolves with statistics about the file generation process.
     */
    abstract generateSingleService(
        interfaceName: string,
        declaration: InterfaceDeclaration | ClassDeclaration,
        outputDir: string,
        lockedFiles: string[],
        options: GenerateOptions,
        generatedServices: GeneratedService[]
    ): Promise<FileStats>;
}
