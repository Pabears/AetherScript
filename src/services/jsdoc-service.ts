/**
 * @fileoverview Service for extracting, formatting, and managing JSDoc from project dependencies.
 */

import { JSDocInfo } from '../jsdoc/extractor';

/**
 * Abstract class defining the contract for a JSDoc service.
 * Implementations will handle the entire pipeline of JSDoc processing.
 * @service
 */
export abstract class JsdocService {
    /**
     * Initializes the service with a specific project path.
     * @param projectPath The root path of the project to analyze.
     */
    abstract initialize(projectPath: string): void;

    /**
     * Extracts JSDoc information for a specific third-party library.
     * It should utilize a cache to avoid re-processing.
     * @param libraryName The name of the library (e.g., 'express').
     * @returns The extracted JSDoc information, or null if not found.
     */
    abstract extractLibraryJSDoc(libraryName: string): Promise<JSDocInfo | null>;

    /**
     * Formats the extracted JSDoc information into a string suitable for LLM consumption.
     * @param jsdocInfo The JSDoc information to format.
     * @returns A string representing the JSDoc in a simplified format (e.g., a TypeScript class).
     */
    abstract formatForLLM(jsdocInfo: JSDocInfo): string;

    /**
     * Generates a simple usage example string based on the JSDoc information.
     * @param jsdocInfo The JSDoc information to use for example generation.
     * @returns A string containing a code usage example.
     */
    abstract generateUsageExample(jsdocInfo: JSDocInfo): string;

    /**
     * Reads all dependencies from the project's package.json and indexes their JSDoc.
     * This populates the cache for faster access later.
     */
    abstract indexAllDependencies(): Promise<void>;

    /**
     * Loads JSDoc information for a library from the cache.
     * @param libraryName The name of the library.
     * @returns The cached JSDoc information, or null if not found.
     */
    abstract loadLibraryJSDoc(libraryName: string): JSDocInfo | null;

    /**
     * Gets the names of all libraries that have been indexed and cached.
     * @returns An array of library names.
     */
    abstract getIndexedLibraries(): string[];

    /**
     * Clears the entire JSDoc cache.
     */
    abstract clearCache(): void;
}
