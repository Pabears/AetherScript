import * as fs from 'fs';
import * as path from 'path';

// --- Lock File Management ---
const LOCK_FILE = 'aesc.lock';

export function getLockData(): string[] {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) || [];
        } catch { return []; }
    }
    return [];
}

export function saveLockData(data: string[]) {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(Array.from(new Set(data)), null, 2));
}

export function handleLockUnlock(paths: string[], action: 'lock' | 'unlock') {
    const actionFunc = action === 'lock' ? lockFile : unlockFile;
    const actionDirFunc = action === 'lock' ? lockDirectory : unlockDirectory;
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

function lockFile(filePath: string) {
    const lockedFiles = getLockData();
    const absolutePath = path.resolve(filePath);
    if (!lockedFiles.includes(absolutePath)) {
        lockedFiles.push(absolutePath);
        saveLockData(lockedFiles);
        console.log(`  -> Locked ${filePath}`);
    }
}

function unlockFile(filePath: string) {
    let lockedFiles = getLockData();
    const absolutePath = path.resolve(filePath);
    const initialCount = lockedFiles.length;
    lockedFiles = lockedFiles.filter(p => p !== absolutePath);
    if (lockedFiles.length < initialCount) {
        saveLockData(lockedFiles);
        console.log(`  -> Unlocked ${filePath}`);
    }
}

function lockDirectory(dirPath: string) {
    const { Project } = require("ts-morph");
    const project = new Project();
    project.addSourceFilesAtPaths(`${dirPath}/**/*.ts`);
    const lockedFiles = getLockData();
    let changed = false;
    for (const sourceFile of project.getSourceFiles()) {
        const filePath = path.resolve(sourceFile.getFilePath());
        if (!lockedFiles.includes(filePath)) {
            lockedFiles.push(filePath);
            changed = true;
        }
    }
    if (changed) saveLockData(lockedFiles);
    console.log(`  -> Locked all files in ${dirPath}`);
}

function unlockDirectory(dirPath: string) {
    let lockedFiles = getLockData();
    const absoluteDirPath = path.resolve(dirPath);
    const initialCount = lockedFiles.length;
    lockedFiles = lockedFiles.filter(p => !p.startsWith(absoluteDirPath));
    if (lockedFiles.length < initialCount) {
        saveLockData(lockedFiles);
        console.log(`  -> Unlocked all files in ${dirPath}`);
    }
}
