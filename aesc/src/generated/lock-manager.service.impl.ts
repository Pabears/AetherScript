import { LockManagerService } from '../services/lock-manager-service';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';

/**
 * @class LockManagerServiceImpl
 * @description
 * Concrete implementation of the LockManagerService.
 * This class contains the actual logic for file locking.
 */
export class LockManagerServiceImpl extends LockManagerService {
    private readonly LOCK_FILE = 'aesc.lock';

    // --- Public API ---

    public lock(paths: string[]): void {
        this.handleLockUnlock(paths, 'lock');
    }

    public unlock(paths: string[]): void {
        this.handleLockUnlock(paths, 'unlock');
    }

    public getLockedFiles(): string[] {
        if (fs.existsSync(this.LOCK_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(this.LOCK_FILE, 'utf-8')) || [];
            } catch { return []; }
        }
        return [];
    }

    public isLocked(filePath: string): boolean {
        const absolutePath = path.resolve(filePath);
        const lockedFiles = this.getLockedFiles();
        return lockedFiles.includes(absolutePath);
    }

    // --- Private Methods (Migrated Logic) ---

    private saveLockData(data: string[]): void {
        fs.writeFileSync(this.LOCK_FILE, JSON.stringify(Array.from(new Set(data)), null, 2));
    }

    private handleLockUnlock(paths: string[], action: 'lock' | 'unlock'): void {
        const actionFunc = action === 'lock' ? this.lockFile.bind(this) : this.unlockFile.bind(this);
        const actionDirFunc = action === 'lock' ? this.lockDirectory.bind(this) : this.unlockDirectory.bind(this);
        for (const p of paths) {
            try {
                if (fs.statSync(p).isDirectory()) {
                    actionDirFunc(p);
                } else {
                    actionFunc(p);
                }
            } catch (error: any) {
                console.error(`Error accessing path ${p}:`, error.message);
            }
        }
    }

    private lockFile(filePath: string): void {
        const lockedFiles = this.getLockedFiles();
        const absolutePath = path.resolve(filePath);
        if (!lockedFiles.includes(absolutePath)) {
            lockedFiles.push(absolutePath);
            this.saveLockData(lockedFiles);
            console.log(`  -> Locked ${filePath}`);
        }
    }

    private unlockFile(filePath: string): void {
        let lockedFiles = this.getLockedFiles();
        const absolutePath = path.resolve(filePath);
        const initialCount = lockedFiles.length;
        lockedFiles = lockedFiles.filter(p => p !== absolutePath);
        if (lockedFiles.length < initialCount) {
            this.saveLockData(lockedFiles);
            console.log(`  -> Unlocked ${filePath}`);
        }
    }

    private lockDirectory(dirPath: string): void {
        const project = new Project();
        project.addSourceFilesAtPaths(`${dirPath}/**/*.ts`);
        const lockedFiles = this.getLockedFiles();
        let changed = false;
        for (const sourceFile of project.getSourceFiles()) {
            const filePath = path.resolve(sourceFile.getFilePath());
            if (!lockedFiles.includes(filePath)) {
                lockedFiles.push(filePath);
                changed = true;
            }
        }
        if (changed) this.saveLockData(lockedFiles);
        console.log(`  -> Locked all files in ${dirPath}`);
    }

    private unlockDirectory(dirPath: string): void {
        let lockedFiles = this.getLockedFiles();
        const absoluteDirPath = path.resolve(dirPath);
        const initialCount = lockedFiles.length;
        lockedFiles = lockedFiles.filter(p => !p.startsWith(absoluteDirPath));
        if (lockedFiles.length < initialCount) {
            this.saveLockData(lockedFiles);
            console.log(`  -> Unlocked all files in ${dirPath}`);
        }
    }
}