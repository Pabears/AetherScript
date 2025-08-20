import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LockManagerServiceImpl } from '../../src/generated/lock-manager.service.impl';
import * as fs from 'fs';
import * as path from 'path';

describe('LockManagerService', () => {
    let service: LockManagerServiceImpl;
    const lockFilePath = path.resolve(process.cwd(), 'aesc.lock');
    const testDir = 'temp_test_dir_for_lock_service';

    beforeEach(() => {
        service = new LockManagerServiceImpl();
        // Create a temporary directory for test files
        fs.mkdirSync(testDir, { recursive: true });

        // Ensure no lock file exists before each test
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
        }
    });

    afterEach(() => {
        // Clean up the lock file and temp directory after each test
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
        }
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('lock() should create a lock file with the absolute path', () => {
        const fileToLock = path.join(testDir, 'test-file.ts');
        fs.writeFileSync(fileToLock, 'content'); // Create the file

        service.lock([fileToLock]);

        expect(fs.existsSync(lockFilePath)).toBe(true);

        const lockedFiles = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
        const expectedPath = path.resolve(process.cwd(), fileToLock);

        expect(lockedFiles).toBeInstanceOf(Array);
        expect(lockedFiles).toHaveLength(1);
        expect(lockedFiles[0]).toBe(expectedPath);
    });

    test('unlock() should remove a path from the lock file', () => {
        const fileToLock = path.join(testDir, 'test-file.ts');
        fs.writeFileSync(fileToLock, 'content');

        service.lock([fileToLock]);
        let lockedFiles = service.getLockedFiles();
        expect(lockedFiles).toHaveLength(1);

        service.unlock([fileToLock]);
        lockedFiles = service.getLockedFiles();
        expect(lockedFiles).toHaveLength(0);
    });

    test('isLocked() should return true for a locked file and false otherwise', () => {
        const fileToLock = path.join(testDir, 'locked.ts');
        const notLockedFile = path.join(testDir, 'unlocked.ts');
        fs.writeFileSync(fileToLock, 'content');
        fs.writeFileSync(notLockedFile, 'content');

        service.lock([fileToLock]);

        expect(service.isLocked(fileToLock)).toBe(true);
        expect(service.isLocked(notLockedFile)).toBe(false);
    });

    test('getLockedFiles() should return all locked file paths', () => {
        const filesToLock = [
            path.join(testDir, 'file1.ts'),
            path.join(testDir, 'file2.ts')
        ];
        filesToLock.forEach(f => fs.writeFileSync(f, 'content'));

        service.lock(filesToLock);

        const lockedFiles = service.getLockedFiles();
        expect(lockedFiles).toHaveLength(2);
        expect(lockedFiles).toContain(path.resolve(process.cwd(), filesToLock[0]));
        expect(lockedFiles).toContain(path.resolve(process.cwd(), filesToLock[1]));
    });
});
