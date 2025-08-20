/**
 * @fileoverview Service for analyzing TypeScript source files to identify
 * dependencies and services for code generation.
 */

import { Project, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import { PropertyDependency } from "../types";

export type ServiceAnalysisResult = {
    declaration: InterfaceDeclaration | ClassDeclaration;
    sourceFile: any; // Using 'any' to avoid circular dependency issues with ts-morph SourceFile
};

/**
 * Abstract class defining the contract for a file analysis service.
 * Implementations will use tools like ts-morph to parse and analyze code.
 * @service
 */
export abstract class FileAnalysisService {
    /**
     * Initializes the service with a ts-morph Project instance.
     * @param project The ts-morph Project to use for analysis.
     */
    abstract initialize(project: Project): void;

    /**
     * Analyzes a class to find its constructor and property dependencies.
     * It specifically looks for properties decorated with `@AutoGen`.
     * @param classDeclaration The class to analyze.
     * @returns An object containing arrays of constructor and property dependencies.
     */
    abstract getDependencies(classDeclaration: ClassDeclaration): { constructorDeps: string[], propertyDeps: PropertyDependency[] };

    /**
     * Analyzes a set of source files to find all services that require
     * automatic implementation generation (marked with `@AutoGen`).
     * @param filePaths An array of file paths to analyze. If empty, analyzes all project files.
     * @returns A map where keys are service names and values are analysis results.
     */
    abstract analyzeSourceFiles(filePaths: string[]): Map<string, ServiceAnalysisResult>;
}
