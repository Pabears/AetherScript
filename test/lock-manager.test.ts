/**
 * lock-manager.test.ts — aesc lock-manager 回归测试
 *
 * 注意：lock-manager 使用 'aesc.lock' 相对路径存储锁文件。
 * 测试通过 process.chdir() 切换到临时目录来隔离，确保不污染项目根目录。
 */
import { test, describe, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// 注意：lock-manager 依赖 process.cwd() 为 'aesc.lock' 的基准目录
// 我们必须在测试前切换工作目录

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesc-lock-'));
    process.chdir(tempDir);
    // 每次测试重新 import（清除模块缓存）以刷新 LOCK_FILE 状态
});

afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
});

// 动态 import（避免模块缓存导致 cwd 固化）
async function getLockManager() {
    // 强制重新加载：添加时间戳 query 参数绕过 bun 的模块缓存
    return import(`../src/lock-manager?t=${Date.now()}`);
}

describe('LockManager 回归测试', () => {

    // 1. 初始状态：无锁文件 → getLockedFiles 返回空数组
    test('能力1: 初始状态 getLockedFiles → []', async () => {
        const { getLockedFiles } = await getLockManager();
        expect(getLockedFiles()).toHaveLength(0);
    });

    // 2. lock → isLocked 返回 true
    test('能力2: lock 文件后 isLocked → true', async () => {
        const { lock, isLocked } = await getLockManager();
        // 创建一个真实文件
        const filePath = path.join(tempDir, 'test.impl.ts');
        fs.writeFileSync(filePath, '// test');
        lock([filePath]);
        expect(isLocked(filePath)).toBe(true);
    });

    // 3. unlock → isLocked 返回 false
    test('能力3: unlock 后 isLocked → false', async () => {
        const { lock, unlock, isLocked } = await getLockManager();
        const filePath = path.join(tempDir, 'another.impl.ts');
        fs.writeFileSync(filePath, '// test');
        lock([filePath]);
        unlock([filePath]);
        expect(isLocked(filePath)).toBe(false);
    });

    // 4. lock 写入的 aesc.lock 文件存在且是合法 JSON
    test('能力4: lock 后 aesc.lock 文件为合法 JSON 数组', async () => {
        const { lock } = await getLockManager();
        const filePath = path.join(tempDir, 'svc.impl.ts');
        fs.writeFileSync(filePath, '// test');
        lock([filePath]);
        const lockFile = path.join(tempDir, 'aesc.lock');
        expect(fs.existsSync(lockFile)).toBe(true);
        const content = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
        expect(Array.isArray(content)).toBe(true);
        expect(content.length).toBeGreaterThan(0);
    });

    // 5. getLockedFiles 返回绝对路径
    test('能力5: getLockedFiles 返回的是绝对路径', async () => {
        const { lock, getLockedFiles } = await getLockManager();
        const filePath = path.join(tempDir, 'abs.impl.ts');
        fs.writeFileSync(filePath, '// test');
        lock([filePath]);
        const locked = getLockedFiles();
        expect(locked.length).toBeGreaterThan(0);
        expect(path.isAbsolute(locked[0]!)).toBe(true);
    });

    // 6. 多次 lock 同一文件 → 不重复记录
    test('能力6: 重复 lock 同一文件 → 不出现重复条目', async () => {
        const { lock, getLockedFiles } = await getLockManager();
        const filePath = path.join(tempDir, 'dup.impl.ts');
        fs.writeFileSync(filePath, '// test');
        lock([filePath]);
        lock([filePath]); // 第二次 lock
        const locked = getLockedFiles();
        const countThisFile = locked.filter(f => f === path.resolve(filePath)).length;
        expect(countThisFile).toBe(1);
    });

    // 7. lock 不存在的路径 → 不崩溃（graceful error handling）
    test('能力7: lock 不存在的路径 → 不崩溃', async () => {
        const { lock } = await getLockManager();
        expect(() => lock(['/tmp/nonexistent-file-aesc-xyz.ts'])).not.toThrow();
    });

    // 8. unlock 未被 lock 的文件 → 不崩溃
    test('能力8: unlock 未被 lock 的文件 → 不崩溃', async () => {
        const { unlock } = await getLockManager();
        const filePath = path.join(tempDir, 'never-locked.impl.ts');
        fs.writeFileSync(filePath, '// test');
        expect(() => unlock([filePath])).not.toThrow();
    });
});
