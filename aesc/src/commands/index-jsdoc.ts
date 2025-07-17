import { JSDocIndexer } from '../jsdoc-indexer';
import * as path from 'path';

/**
 * JSDoc 索引命令 - 批量索引 package.json 中的所有依赖
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
 * 清除 JSDoc 索引缓存
 */
export function clearJSDocIndexCommand(projectPath?: string): void {
    const targetPath = projectPath || process.cwd();
    
    console.log(`[JSDoc Index] Clearing JSDoc index for project: ${targetPath}`);
    
    const indexer = new JSDocIndexer(targetPath);
    indexer.clearIndex();
    
    console.log(`[JSDoc Index] Index cleared successfully!`);
}
