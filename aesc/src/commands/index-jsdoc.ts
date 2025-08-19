import { JSDocIndexer } from '../jsdoc/indexer';
import * as path from 'path';

/**
 * JSDoc index command - Batch index all dependencies in package.json
 */
export async function indexJSDocCommand(projectPath?: string): Promise<void> {
    const targetPath = projectPath || process.cwd();
    
    console.log(`[JSDoc Index] Starting JSDoc indexing for project: ${targetPath}`);
    
    const indexer = new JSDocIndexer(targetPath);
    
    try {
        await indexer.indexAllDependencies();
        
        const indexedLibraries = indexer.getIndexedLibraries();
        console.log(`[JSDoc Index] Indexing completed successfully!`);
        console.log(`[JSDoc Index] Total indexed libraries: ${indexedLibraries.length}`);
        
        if (indexedLibraries.length > 0) {
            console.log(`[JSDoc Index] Indexed libraries:`);
            indexedLibraries.forEach(lib => console.log(`  - ${lib}`));
        }
        
    } catch (error) {
        console.error(`[JSDoc Index] Error during indexing:`, error);
        process.exit(1);
    }
}

/**
 * Clear JSDoc index cache
 */
export function clearJSDocIndexCommand(projectPath?: string): void {
    const targetPath = projectPath || process.cwd();
    
    console.log(`[JSDoc Index] Clearing JSDoc index for project: ${targetPath}`);
    
    const indexer = new JSDocIndexer(targetPath);
    indexer.clearIndex();
    
    console.log(`[JSDoc Index] Index cleared successfully!`);
}
