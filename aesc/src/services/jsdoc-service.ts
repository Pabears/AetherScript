import type { JSDocInfo } from '../types';

/**
 * @abstract
 * @class JSDocService
 * @description
 * Service for extracting, formatting, and managing JSDoc information from project dependencies.
 * It handles caching, indexing, and presenting the JSDoc in an LLM-friendly format.
 */
export abstract class JSDocService {
    /**
     * @abstract
     * @method getLibraryJSDoc
     * @description
     * Extracts and returns the raw JSDoc information for a given library.
     * Uses a cache to avoid re-processing.
     * @param {string} libraryName - The name of the library (e.g., 'node-cache').
     * @returns {Promise<JSDocInfo | null>} The structured JSDoc information, or null if not found.
     */
    abstract getLibraryJSDoc(libraryName: string): Promise<JSDocInfo | null>;

    /**
     * @abstract
     * @method getFormattedLibraryJSDoc
     * @description
     * Extracts JSDoc information for a library and formats it into a single,
     * LLM-friendly TypeScript code string.
     * @param {string} libraryName - The name of the library.
     * @returns {Promise<string | null>} A formatted string representing the library's API, or null if not found.
     */
    abstract getFormattedLibraryJSDoc(libraryName: string): Promise<string | null>;

    /**
     * @abstract
     * @method indexAllDependencies
     * @description
     * Reads the project's package.json and batch-processes all dependencies,
     * extracting and caching their JSDoc information for later use.
     * @returns {Promise<void>}
     */
    abstract indexAllDependencies(): Promise<void>;

    /**
     * @abstract
     * @method clearCache
     * @description
     * Deletes all cached JSDoc information from the .jsdoc directory.
     * @returns {Promise<void>}
     */
    abstract clearCache(): Promise<void>;

    /**
     * @abstract
     * @method getIndexedLibraries
     * @description
     * Returns a list of all library names that have been successfully indexed and cached.
     * @returns {Promise<string[]>} A list of library names.
     */
    abstract getIndexedLibraries(): Promise<string[]>;
}
