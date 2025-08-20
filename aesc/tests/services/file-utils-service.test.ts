import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { FileUtilsServiceImpl } from '../../src/generated/file-utils.service.impl';
import * as fs from 'fs';
import * as path from 'path';

describe('FileUtilsService', () => {
    let service: FileUtilsServiceImpl;
    const testDir = 'temp_test_dir_for_file_utils';

    beforeEach(() => {
        service = new FileUtilsServiceImpl();
        // Create a temporary directory for test files
        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up the temp directory after each test
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('ensureOutputDirectory should create a directory if it does not exist', () => {
        const newDir = path.join(testDir, 'new_dir');
        expect(fs.existsSync(newDir)).toBe(false);

        service.ensureOutputDirectory(newDir, false);

        expect(fs.existsSync(newDir)).toBe(true);
    });

    test('ensureOutputDirectory with force=true should delete and recreate the directory', () => {
        const dir = path.join(testDir, 'forced_dir');
        const dummyFile = path.join(dir, 'dummy.txt');

        // Setup initial directory and file
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dummyFile, 'hello');
        expect(fs.existsSync(dummyFile)).toBe(true);

        // Act
        service.ensureOutputDirectory(dir, true);

        // Assert
        expect(fs.existsSync(dir)).toBe(true); // Directory should exist
        expect(fs.existsSync(dummyFile)).toBe(false); // But the content should be gone
    });

    test('saveGeneratedFile should write content to a file', () => {
        const filePath = path.join(testDir, 'output.ts');
        const content = 'export class MyTest {}';

        service.saveGeneratedFile(filePath, content);

        expect(fs.existsSync(filePath)).toBe(true);
        const writtenContent = fs.readFileSync(filePath, 'utf-8');
        expect(writtenContent).toBe(content);
    });
});
