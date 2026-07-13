#!/usr/bin/env bun
/**
 * aesc lock-manager — 保护手动修改的 impl 文件不被重新生成
 *
 * 用法：
 *   bun src/lock-manager.ts lock <file-or-dir> [...]
 *   bun src/lock-manager.ts unlock <file-or-dir> [...]
 *   bun src/lock-manager.ts list
 *   bun src/lock-manager.ts check <file>
 */

import { Project } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';

const LOCK_FILE = 'aesc.lock';

// ────────────────────────────────────────────────────────────
// Core API
// ────────────────────────────────────────────────────────────

export function getLockedFiles(): string[] {
    if (!fs.existsSync(LOCK_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) as string[];
    } catch {
        return [];
    }
}

export function isLocked(filePath: string): boolean {
    return getLockedFiles().includes(path.resolve(filePath));
}

export function lock(paths: string[]): void {
    const locked = new Set(getLockedFiles());

    for (const p of paths) {
        try {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                lockDirectory(p, locked);
            } else {
                const abs = path.resolve(p);
                if (!locked.has(abs)) {
                    locked.add(abs);
                    console.log(`  🔒 Locked: ${p}`);
                } else {
                    console.log(`  ℹ️  Already locked: ${p}`);
                }
            }
        } catch (err: any) {
            console.error(`  ❌ Error accessing ${p}: ${err.message}`);
        }
    }

    saveLockFile([...locked]);
}

export function unlock(paths: string[]): void {
    const locked = new Set(getLockedFiles());

    for (const p of paths) {
        try {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                unlockDirectory(p, locked);
            } else {
                const abs = path.resolve(p);
                if (locked.has(abs)) {
                    locked.delete(abs);
                    console.log(`  🔓 Unlocked: ${p}`);
                } else {
                    console.log(`  ℹ️  Not locked: ${p}`);
                }
            }
        } catch (err: any) {
            console.error(`  ❌ Error accessing ${p}: ${err.message}`);
        }
    }

    saveLockFile([...locked]);
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function lockDirectory(dirPath: string, locked: Set<string>): void {
    const project = new Project();
    project.addSourceFilesAtPaths(`${dirPath}/**/*.ts`);
    let count = 0;
    for (const sf of project.getSourceFiles()) {
        const abs = path.resolve(sf.getFilePath());
        if (!locked.has(abs)) {
            locked.add(abs);
            count++;
        }
    }
    console.log(`  🔒 Locked ${count} file(s) in: ${dirPath}`);
}

function unlockDirectory(dirPath: string, locked: Set<string>): void {
    const absDirPath = path.resolve(dirPath);
    const before = locked.size;
    for (const p of [...locked]) {
        if (p.startsWith(absDirPath)) locked.delete(p);
    }
    const removed = before - locked.size;
    console.log(`  🔓 Unlocked ${removed} file(s) in: ${dirPath}`);
}

function saveLockFile(paths: string[]): void {
    fs.writeFileSync(LOCK_FILE, JSON.stringify([...new Set(paths)], null, 2), 'utf-8');
}

// ────────────────────────────────────────────────────────────
// CLI Entry
// ────────────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const targets = args.slice(1);

    switch (command) {
        case 'lock':
            if (targets.length === 0) { console.error('Usage: lock <file-or-dir> [...]'); process.exit(1); }
            lock(targets);
            break;

        case 'unlock':
            if (targets.length === 0) { console.error('Usage: unlock <file-or-dir> [...]'); process.exit(1); }
            unlock(targets);
            break;

        case 'list': {
            const files = getLockedFiles();
            if (files.length === 0) {
                console.log('No files are currently locked.');
            } else {
                console.log(`Locked files (${files.length}):`);
                files.forEach(f => console.log(`  🔒 ${f}`));
            }
            break;
        }

        case 'check': {
            const file = targets[0];
            if (!file) { console.error('Usage: check <file>'); process.exit(1); }
            console.log(isLocked(file) ? `🔒 LOCKED: ${file}` : `🔓 NOT LOCKED: ${file}`);
            break;
        }

        default:
            console.error('Commands: lock | unlock | list | check');
            process.exit(1);
    }
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
    main();
}
