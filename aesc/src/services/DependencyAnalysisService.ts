import type { ClassDeclaration, InterfaceDeclaration, DependencyInfo } from './types';

/**
 * Abstract class for a dependency analysis service.
 * This service is responsible for analyzing the dependencies of a given
 * class or interface declaration within the project.
 */
export abstract class DependencyAnalysisService {
    /**
     * Generates dependency information for a given declaration.
     * This includes both project-internal dependencies and third-party libraries with JSDoc.
     * @param declaration The ts-morph declaration to analyze.
     * @param originalImportPath The original path of the file containing the declaration.
     * @param generatedFilePath The path where the generated file will be stored.
     * @returns An object containing the dependency text and the original code.
     */
    abstract generateDependencyInfo(
        declaration: InterfaceDeclaration | ClassDeclaration,
        originalImportPath: string,
        generatedFilePath: string
    ): DependencyInfo;
}
