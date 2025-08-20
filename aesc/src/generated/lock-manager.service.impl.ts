import { LockManagerService } from '../services/lock-manager-service';
import {
    handleLockUnlock,
    getLockData,
} from '../core/lock-manager';
import * as path from 'path';

/**
 * @class LockManagerServiceImpl
 * @description
 * Concrete implementation of the LockManagerService.
 * It uses the original functions from `lock-manager.ts`.
 */
export class LockManagerServiceImpl extends LockManagerService {
    lock(paths: string[]): void {
        handleLockUnlock(paths, 'lock');
    }

    unlock(paths: string[]): void {
        handleLockUnlock(paths, 'unlock');
    }

    getLockedFiles(): string[] {
        return getLockData();
    }

    isLocked(filePath: string): boolean {
        const absolutePath = path.resolve(filePath);
        const lockedFiles = this.getLockedFiles();
        return lockedFiles.includes(absolutePath);
    }
}
