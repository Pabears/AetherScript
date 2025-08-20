import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { JSDocServiceImpl } from '../../src/generated/jsdoc.service.impl';
import * as path from 'path';
import * as fs from 'fs';

describe('JSDocService', () => {
    const testProjectPath = path.resolve(process.cwd(), '../aesc_tests/jsdoc_service_test');
    const cacheDir = path.join(testProjectPath, '.jsdoc');
    const cacheFile = path.join(cacheDir, 'node-cache.json');
    let service: JSDocServiceImpl;

    beforeEach(() => {
        // Instantiate the service pointing to our test project
        service = new JSDocServiceImpl(testProjectPath);
    });

    afterEach(() => {
        // Clean up the cache directory after each test
        if (fs.existsSync(cacheDir)) {
            fs.rmSync(cacheDir, { recursive: true, force: true });
        }
    });

    test('indexAllDependencies should create a cache file for a dependency', async () => {
        await service.indexAllDependencies();
        
        // Check that the cache file was created
        expect(fs.existsSync(cacheFile)).toBe(true);

        // Check the content of the cache file
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        expect(cachedData.name).toBe('node-cache');
        expect(cachedData.methods.length).toBe(2);
        expect(cachedData.methods.find(m => m.name === 'set')).toBeDefined();
    });

    test('getLibraryJSDoc should return null for non-existent library', async () => {
        const result = await service.getLibraryJSDoc('non-existent-lib');
        expect(result).toBeNull();
    });

    test('getLibraryJSDoc should return cached JSDoc info', async () => {
        // First, index it
        await service.indexAllDependencies();
        
        // Then, get it
        const result = await service.getLibraryJSDoc('node-cache');
        expect(result).not.toBeNull();
        expect(result?.name).toBe('node-cache');
        expect(result?.description).toContain('A simple in-memory cache');
    });

    test('getFormattedLibraryJSDoc should return a formatted string', async () => {
        const formattedString = await service.getFormattedLibraryJSDoc('node-cache');
        expect(formattedString).not.toBeNull();
        if (formattedString) {
            expect(formattedString).toContain('class node-cache');
            expect(formattedString).toContain('set(key: string, value: any): boolean;');
            expect(formattedString).toContain('get(key: string): any;');
        }
    });
    
    test('clearCache should delete the cache file', async () => {
        // First, index it
        await service.indexAllDependencies();
        expect(fs.existsSync(cacheFile)).toBe(true);

        // Then, clear it
        await service.clearCache();
        expect(fs.existsSync(cacheFile)).toBe(false);
    });
});
