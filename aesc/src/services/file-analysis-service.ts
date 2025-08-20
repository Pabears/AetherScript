import type { Project, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import type { PropertyDependency } from "../types";

/**
 * @abstract
 * @class FileAnalysisService
 * @description
 * Service responsible for analyzing TypeScript source files using ts-morph.
 * It can extract dependencies from classes and identify services for generation.
 */
export abstract class FileAnalysisService {
    /**
     * @abstract
     * @method getDependencies
     * @description
     * Analyzes a class declaration to find its constructor and property dependencies.
     * Property dependencies are identified by the @AutoGen decorator.
     * @param {ClassDeclaration} cls - The ts-morph ClassDeclaration to analyze.
     * @returns {{ constructorDeps: string[], propertyDeps: PropertyDependency[] }} An object containing dependency information.
     */
    abstract getDependencies(cls: ClassDeclaration): { constructorDeps: string[], propertyDeps: PropertyDependency[] };

    /**
     * @abstract
     * @method analyzeSourceFiles
     * @description
     * Analyzes all source files in a project to find all services that require
     * automatic implementation, based on the @AutoGen decorator.
     * @param {Project} project - The ts-morph Project instance.
     * @param {string[]} files - An optional list of specific file names to analyze, limiting the scope.
     * @returns {Map<string, { declaration: InterfaceDeclaration | ClassDeclaration, sourceFile: any }>} A map of services to be generated.
     */
    abstract analyzeSourceFiles(project: Project, files: string[]): Map<string, { declaration: InterfaceDeclaration | ClassDeclaration, sourceFile: any }>;
}
