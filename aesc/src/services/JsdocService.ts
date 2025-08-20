/**
 * Abstract class for a JSDoc service.
 * This service is responsible for extracting, parsing, formatting,
 * and indexing JSDoc comments from the project and its dependencies.
 */
export abstract class JsdocService {
    /**
     * Processes the JSDoc for a given library, which may involve
     * extracting, formatting, and caching the documentation.
     * @param libraryName The name of the library to process.
     */
    abstract processLibrary(libraryName: string): Promise<void>;

    /**
     * Retrieves the parsed JSDoc for a given library.
     * @param libraryName The name of the library.
     * @returns The parsed JSDoc data, or null/undefined if not found.
     */
    abstract getLibraryJSDoc(libraryName: string): any;

    /**
     * Indexes the JSDoc for all dependencies found in the project's package.json.
     */
    abstract indexAllDependencies(): Promise<void>;

    /**
     * Clears any cached or indexed JSDoc data.
     */
    abstract clearCache(): void;
}
