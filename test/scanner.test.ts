/**
 * scanner.test.ts — aesc scanner 回归测试
 *
 * 每个测试用例对应一项「不能退步」的能力。
 * 测试通过创建真实的临时 TS 项目文件来驱动，确保测的是真实行为。
 */
import { test, describe, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scan } from '../src/scanner';

// ─── 临时项目工厂 ─────────────────────────────────────────────

const MINIMAL_TSCONFIG = JSON.stringify({
    compilerOptions: {
        target: 'ESNext', module: 'Preserve', moduleResolution: 'bundler',
        experimentalDecorators: true, strict: false, skipLibCheck: true,
        allowImportingTsExtensions: true, noEmit: true,
    },
    include: ['src/**/*.ts'],
});

function makeTempProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesc-scanner-'));
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), MINIMAL_TSCONFIG);
    return dir;
}

const tempDirs: string[] = [];

afterEach(() => {
    for (const d of tempDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function tempProject(...files: Array<[string, string]>): string {
    const dir = makeTempProject();
    tempDirs.push(dir);
    for (const [relPath, content] of files) {
        const abs = path.join(dir, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    return dir;
}

// ─── 测试套件 ─────────────────────────────────────────────────

describe('Scanner 回归测试', () => {

    // 1. 最核心能力：@AutoGen 属性检测
    test('能力1: @AutoGen 属性 → 检测到目标类型', () => {
        const dir = tempProject(
            ['src/db.ts', `
export abstract class DB {
    public abstract save(key: string, val: any): void;
    public abstract find(key: string): any;
}
`],
            ['src/user-service.ts', `
import type { DB } from './db';
// @autogen
export abstract class UserService {
    // @AutoGen
    public db?: DB;
    public abstract create(name: string): void;
}
`],
        );
        const result = scan(dir);
        expect(result.classes.length).toBeGreaterThanOrEqual(1);
        const names = result.classes.map(c => c.className);
        expect(names).toContain('DB');
        expect(names).toContain('UserService');
    });

    // 2. @autogen 注释检测（另一种标记方式）
    test('能力2: // @autogen 注释 → 检测到 abstract class', () => {
        const dir = tempProject(
            ['src/cache.ts', `
// @autogen
export abstract class CacheService {
    public abstract get(key: string): string | undefined;
    public abstract set(key: string, val: string): void;
}
`],
        );
        const result = scan(dir);
        const found = result.classes.find(c => c.className === 'CacheService');
        expect(found).toBeDefined();
        expect(found?.isAbstractClass).toBe(true);
    });

    // 3. 关键边界：generated/ 目录必须被跳过（避免扫到已生成的 impl）
    test('能力3: src/generated/ 目录被跳过，不扫描 impl 文件', () => {
        const dir = tempProject(
            ['src/my-service.ts', `
// @autogen
export abstract class MyService {
    public abstract doWork(): void;
}
`],
            // 生成目录里的文件，不应被当作新的扫描目标
            ['src/generated/myservice.impl.ts', `
// @autogen
export abstract class ShouldNotBeSeen {
    public abstract ghost(): void;
}
`],
        );
        const result = scan(dir);
        const names = result.classes.map(c => c.className);
        expect(names).not.toContain('ShouldNotBeSeen');
        expect(names).toContain('MyService');
    });

    // 4. JSDoc 契约提取：方法的 jsDoc 字段必须包含原始注释
    test('能力4: abstract 方法的 JSDoc 被正确提取', () => {
        const dir = tempProject(
            ['src/svc.ts', `
// @autogen
export abstract class OrderService {
    /**
     * Create order
     * @param id - order id
     * @throws Error if id is empty
     */
    public abstract createOrder(id: string): void;
}
`],
        );
        const result = scan(dir);
        const cls = result.classes.find(c => c.className === 'OrderService');
        expect(cls).toBeDefined();
        const method = cls?.methods.find(m => m.name === 'createOrder');
        expect(method?.jsDoc).toContain('@throws');
        expect(method?.jsDoc).toContain('@param');
        expect(method?.isAbstract).toBe(true);
    });

    // 5. autoGenDependencies：依赖类型的源码被包含在 JSON 中
    test('能力5: @AutoGen 依赖类型的源码被收入 autoGenDependencies', () => {
        const dir = tempProject(
            ['src/storage.ts', `
export abstract class Storage {
    public abstract store(key: string, val: any): void;
}
`],
            ['src/app-service.ts', `
import type { Storage } from './storage';
// @autogen
export abstract class AppService {
    // @AutoGen
    public storage?: Storage;
    public abstract run(): void;
}
`],
        );
        const result = scan(dir);
        const cls = result.classes.find(c => c.className === 'AppService');
        expect(cls?.autoGenDependencies.length).toBeGreaterThan(0);
        const dep = cls?.autoGenDependencies.find(d => d.typeName === 'Storage');
        expect(dep).toBeDefined();
        expect(dep?.sourceCode).toContain('abstract class Storage');
        expect(dep?.sourceCode).toContain('store');
    });

    // 6. outputPath 格式：应为 src/generated/[小写类名].impl.ts
    test('能力6: outputPath 使用正确的小写命名规则', () => {
        const dir = tempProject(
            ['src/my-big-service.ts', `
// @autogen
export abstract class MyBigService {
    public abstract work(): void;
}
`],
        );
        const result = scan(dir);
        const cls = result.classes.find(c => c.className === 'MyBigService');
        expect(cls?.outputPath).toBe('src/generated/mybigservice.impl.ts');
    });

    // 7. 无标记的 abstract class → 不被扫描
    test('能力7: 没有 @AutoGen/@autogen 标记的 abstract class 被忽略', () => {
        const dir = tempProject(
            ['src/plain.ts', `
// 普通抽象类，无任何 aesc 标记
export abstract class PlainBase {
    public abstract doSomething(): void;
}
`],
        );
        const result = scan(dir);
        expect(result.classes.find(c => c.className === 'PlainBase')).toBeUndefined();
    });

    // 8. 空项目：不崩溃，返回空结果
    test('能力8: 空项目不崩溃，返回 classes = []', () => {
        const dir = tempProject(); // 只有 tsconfig.json，src/ 为空
        const result = scan(dir);
        expect(result.classes).toHaveLength(0);
        expect(result.projectRoot).toBeTruthy();
    });

    // 9. isAutoGen property 标记正确
    test('能力9: @AutoGen 属性在 properties 数组中 isAutoGen = true', () => {
        const dir = tempProject(
            ['src/dep.ts', `export abstract class Dep { public abstract ping(): void; }`],
            ['src/svc.ts', `
import type { Dep } from './dep';
// @autogen
export abstract class SomeService {
    // @AutoGen
    public dep?: Dep;
    public abstract run(): void;
}
`],
        );
        const result = scan(dir);
        const cls = result.classes.find(c => c.className === 'SomeService');
        const depProp = cls?.properties.find(p => p.name === 'dep');
        expect(depProp?.isAutoGen).toBe(true);
    });

    // 10. scannedAt 和 projectRoot 字段被正确填写
    test('能力10: ScanResult 元数据字段正确', () => {
        const dir = tempProject();
        const before = Date.now();
        const result = scan(dir);
        const after = Date.now();
        expect(new Date(result.scannedAt).getTime()).toBeGreaterThanOrEqual(before);
        expect(new Date(result.scannedAt).getTime()).toBeLessThanOrEqual(after);
        expect(result.projectRoot).toBe(path.resolve(dir));
    });
});
