import type {
    PropertyDependency,
    ClassDeclaration,
    CodeProject,
    InterfaceDeclaration
} from './types';

/**
 * Abstract class for a file analysis service.
 * This service is responsible for analyzing TypeScript source files to understand
 * class dependencies, decorators, and other structural information.
 */
export abstract class FileAnalysisService {
    /**
     * Analyzes a class and returns its constructor and property dependencies.
     * @param cls The class declaration to analyze.
     * @returns An object containing arrays of constructor and property dependencies.
     */
    abstract getDependencies(cls: ClassDeclaration): { constructorDeps: string[], propertyDeps: PropertyDependency[] };

    /**
     * Analyzes a set of source files within a project to find services that need to be generated.
     * @param project The ts-morph project instance.
     * @param files An array of file paths to analyze. If empty, all project files will be analyzed.
     * @returns A map where keys are service interface names and values are details about the declaration.
     */
    abstract analyzeSourceFiles(project: CodeProject, files: string[]): Map<string, { declaration: InterfaceDeclaration | ClassDeclaration, sourceFile: any }>;
}
