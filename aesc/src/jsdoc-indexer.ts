import * as fs from 'fs';
import * as path from 'path';
import { JSDocExtractor } from './jsdoc-extractor';
import type { JSDocInfo } from './jsdoc-extractor';

/**
 * JSDoc Indexer - Batch process all dependencies in package.json
 */
export class JSDocIndexer {
    private projectPath: string;
    private jsdocDir: string;
    private extractor: JSDocExtractor;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.jsdocDir = path.join(projectPath, '.jsdoc');
        this.extractor = new JSDocExtractor(projectPath);
        this.ensureJSDocDir();
    }

    private ensureJSDocDir() {
        if (!fs.existsSync(this.jsdocDir)) {
            fs.mkdirSync(this.jsdocDir, { recursive: true });
        }
    }

    /**
     * Read all dependencies from package.json and batch index them
     */
    public async indexAllDependencies(): Promise<void> {
        console.log('[JSDoc Indexer] Starting dependency indexing...');
        
        const packageJsonPath = path.join(this.projectPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            console.log('[JSDoc Indexer] No package.json found, skipping indexing');
            return;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = {
            ...packageJson.dependencies || {},
            ...packageJson.devDependencies || {}
        };

        const dependencyNames = Object.keys(dependencies);
        console.log(`[JSDoc Indexer] Found ${dependencyNames.length} dependencies to index`);

        let indexedCount = 0;
        let skippedCount = 0;

        for (const dependencyName of dependencyNames) {
            // Skip @types packages as they are usually type definitions, not main packages
            if (dependencyName.startsWith('@types/')) {
                skippedCount++;
                continue;
            }

            const cachedPath = path.join(this.jsdocDir, `${dependencyName}.json`);
            
            // Skip if already indexed
            if (fs.existsSync(cachedPath)) {
                console.log(`[JSDoc Indexer] ${dependencyName} already indexed, skipping`);
                skippedCount++;
                continue;
            }

            console.log(`[JSDoc Indexer] Indexing ${dependencyName}...`);
            
            try {
                const jsdocInfo = this.extractor.extractLibraryJSDoc(dependencyName);
                if (jsdocInfo) {
                    fs.writeFileSync(cachedPath, JSON.stringify(jsdocInfo, null, 2));
                    console.log(`[JSDoc Indexer] Successfully indexed ${dependencyName}`);
                    indexedCount++;
                } else {
                    console.log(`[JSDoc Indexer] No JSDoc found for ${dependencyName}`);
                    skippedCount++;
                }
            } catch (error) {
                console.error(`[JSDoc Indexer] Error indexing ${dependencyName}:`, error);
                skippedCount++;
            }
        }

        console.log(`[JSDoc Indexer] Indexing complete. Indexed: ${indexedCount}, Skipped: ${skippedCount}`);
    }

    /**
     * Load documentation for specified library from .jsdoc directory
     */
    public loadLibraryJSDoc(libraryName: string): JSDocInfo | null {
        const cachedPath = path.join(this.jsdocDir, `${libraryName}.json`);
        
        if (!fs.existsSync(cachedPath)) {
            return null;
        }

        try {
            const cached = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
            return cached;
        } catch (error) {
            console.error(`[JSDoc Indexer] Error loading cached JSDoc for ${libraryName}:`, error);
            return null;
        }
    }

    /**
     * Get all indexed library names
     */
    public getIndexedLibraries(): string[] {
        if (!fs.existsSync(this.jsdocDir)) {
            return [];
        }

        return fs.readdirSync(this.jsdocDir)
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));
    }

    /**
     * Clear all index cache
     */
    public clearIndex(): void {
        if (fs.existsSync(this.jsdocDir)) {
            const files = fs.readdirSync(this.jsdocDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    fs.unlinkSync(path.join(this.jsdocDir, file));
                }
            }
            console.log('[JSDoc Indexer] Index cache cleared');
        }
    }
}
