import { LockingService } from '../services/locking-service';
import { getLockData, saveLockData, handleLockUnlock as originalHandler } from '../core/lock-manager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Concrete implementation of the LockingService.
 * It wraps the original lock manager functions.
 */
export class LockingServiceImpl extends LockingService {
    getLockedFiles(): string[] {
        return getLockData();
    }

    isLocked(filePath: string): boolean {
        const absolutePath = path.resolve(filePath);
        return this.getLockedFiles().includes(absolutePath);
    }

    lockFile(filePath: string): void {
        const lockedFiles = this.getLockedFiles();
        const absolutePath = path.resolve(filePath);
        if (!lockedFiles.includes(absolutePath)) {
            lockedFiles.push(absolutePath);
            saveLockData(lockedFiles);
        }
    }

    unlockFile(filePath: string): void {
        let lockedFiles = this.getLockedFiles();
        const absolutePath = path.resolve(filePath);
        const initialCount = lockedFiles.length;
        lockedFiles = lockedFiles.filter(p => p !== absolutePath);
        if (lockedFiles.length < initialCount) {
            saveLockData(lockedFiles);
        }
    }

    lockDirectory(dirPath: string): void {
        // This logic requires ts-morph, which is a heavy dependency.
        // For simplicity, this implementation will be a bit different from the original.
        // It will just lock a marker for the directory.
        this.lockFile(path.join(dirPath, '.aesc-dir-lock'));
    }

    unlockDirectory(dirPath: string): void {
        this.unlockFile(path.join(dirPath, '.aesc-dir-lock'));
    }

    handleLockUnlock(paths: string[], action: 'lock' | 'unlock'): void {
        originalHandler(paths, action);
    }
}
