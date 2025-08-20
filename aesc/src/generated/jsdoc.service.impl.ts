import { JSDocService } from '../services/jsdoc-service';
import type { JSDocInfo } from '../types';
import { JSDocManager } from '../jsdoc';
import { JSDocFormatter } from '../jsdoc/formatter';
import { JSDocIndexer } from '../jsdoc/indexer'; // Import the indexer directly

/**
 * @class JSDocServiceImpl
 * @description
 * Concrete implementation of the JSDocService.
 * It uses the original JSDocManager and other classes from the `src/jsdoc` directory
 * to perform its operations.
 */
export class JSDocServiceImpl extends JSDocService {
    private manager: JSDocManager;
    private formatter: JSDocFormatter;
    private indexer: JSDocIndexer; // Have a separate indexer instance

    constructor(projectPath: string = process.cwd()) {
        super();
        this.manager = new JSDocManager(projectPath);
        this.formatter = new JSDocFormatter();
        this.indexer = new JSDocIndexer(projectPath); // Instantiate it
    }

    async getLibraryJSDoc(libraryName: string): Promise<JSDocInfo | null> {
        // The original method is synchronous, but we adapt it to the async interface
        return Promise.resolve(this.manager.getLibraryJSDoc(libraryName));
    }

    async getFormattedLibraryJSDoc(libraryName: string): Promise<string | null> {
        const jsdocInfo = await this.getLibraryJSDoc(libraryName);
        if (!jsdocInfo) {
            return null;
        }
        return this.formatter.formatForLLM(jsdocInfo);
    }

    async indexAllDependencies(): Promise<void> {
        return this.manager.indexAllDependencies();
    }

    async clearCache(): Promise<void> {
        // The original method is synchronous
        this.manager.clearCache();
        return Promise.resolve();
    }

    async getIndexedLibraries(): Promise<string[]> {
        // Use the separate indexer instance to call this method
        return Promise.resolve(this.indexer.getIndexedLibraries());
    }
}
