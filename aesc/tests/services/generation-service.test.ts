import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { GenerationServiceImpl } from '../../src/generated/generation.service.impl';
import type { GenerateOptions } from '../../src/types';
import * as path from 'path';
import * as fs from 'fs';

describe('GenerationService (E2E)', () => {
    const originalCwd = process.cwd();
    // Resolve path from the 'aesc' directory where `bun test` is run
    const testProjectPath = path.resolve(originalCwd, '../aesc_tests/service_generation_test');
    const generatedDir = path.join(testProjectPath, 'src/generated');
    const implFile = path.join(generatedDir, 'dbservice.service.impl.ts');
    const containerFile = path.join(generatedDir, 'container.ts');

    beforeAll(() => {
        // Change directory to the test project so the service operates on it
        process.chdir(testProjectPath);
    });

    afterAll(() => {
        // Change back to the original directory and clean up
        process.chdir(originalCwd);
        if (fs.existsSync(generatedDir)) {
            fs.rmSync(generatedDir, { recursive: true, force: true });
        }
    });

    test('generate should create implementation and container files', async () => {
        // Ensure the generated directory is clean before starting
        if (fs.existsSync(generatedDir)) {
            fs.rmSync(generatedDir, { recursive: true, force: true });
        }

        const service = new GenerationServiceImpl();
        const options: GenerateOptions = {
            force: true, // Use force to ensure regeneration
            files: [],
            verbose: false,
            model: 'codellama', // A default model
        };

        const result = await service.generate(options);

        // 1. Check the result object
        expect(result.success).toBe(true);
        expect(result.fileStats.some(f => f.interfaceName === 'DbService' && f.status === 'generated')).toBe(true);

        // 2. Check for the existence of generated files
        expect(fs.existsSync(implFile)).toBe(true);
        expect(fs.existsSync(containerFile)).toBe(true);

        // 3. Check the content of the container file
        const containerContent = fs.readFileSync(containerFile, 'utf-8');
        expect(containerContent).toContain('DbServiceImpl');
        expect(containerContent).toContain("'DbService': () => {");
        expect(containerContent).toContain("const instance = new DbServiceImpl()");
    }, 120000); // Increase timeout for this E2E test, as it involves a real model call
});
