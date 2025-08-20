import type { InterfaceDeclaration, ClassDeclaration } from "ts-morph";

/**
 * @abstract
 * @class DependencyAnalysisService
 * @description
 * Service responsible for analyzing the dependencies of a given class or interface.
 * It recursively discovers both internal project dependencies and external third-party libraries,
 * gathering their source code or JSDoc information to provide context for code generation.
 */
export abstract class DependencyAnalysisService {
    /**
     * @abstract
     * @method generateDependencyInfo
     * @description
     * Analyzes a declaration to produce a string containing the full source code
     * of all its dependencies, which can be injected into an LLM prompt.
     * @param {InterfaceDeclaration | ClassDeclaration} declaration - The class or interface to analyze.
     * @param {string} originalImportPath - The original import path of the declaration.
     * @param {string} generatedFilePath - The path where the new file will be generated.
     * @returns {{ dependenciesText: string; originalCode: string }} An object containing the
     * full text of all dependencies and the original declaration's code.
     */
    abstract generateDependencyInfo(
        declaration: InterfaceDeclaration | ClassDeclaration,
        originalImportPath: string,
        generatedFilePath: string
    ): { dependenciesText: string; originalCode: string };
}
