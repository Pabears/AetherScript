/**
 * container-gen.test.ts — aesc container-gen 回归测试
 *
 * 策略：创建真实的临时项目 + impl 文件，调用 generateContainer，
 * 再读取生成的 container.ts 验证内容正确。
 */
import { test, describe, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateContainer } from '../src/container-gen';

// ─── Helpers ─────────────────────────────────────────────────

const TSCONFIG = JSON.stringify({
    compilerOptions: {
        target: 'ESNext', module: 'Preserve', moduleResolution: 'bundler',
        experimentalDecorators: true, strict: false, skipLibCheck: true,
        allowImportingTsExtensions: true, noEmit: true,
    },
    include: ['src/**/*.ts'],
});

const tempDirs: string[] = [];
afterEach(() => {
    for (const d of tempDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function makeProject(...files: Array<[string, string]>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesc-cg-'));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'src', 'generated'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), TSCONFIG);
    for (const [relPath, content] of files) {
        const abs = path.join(dir, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    return dir;
}

function containerContent(dir: string): string {
    return fs.readFileSync(path.join(dir, 'src', 'generated', 'container.ts'), 'utf-8');
}

// ─── Tests ───────────────────────────────────────────────────

describe('ContainerGen 回归测试', () => {

    // 1. 单个 impl → ServiceMap 出现正确条目
    test('能力1: 单个 impl → ServiceMap 中出现对应键值', () => {
        const dir = makeProject(
            ['src/calc.ts', `export abstract class Calc { public abstract add(a: number, b: number): number; }`],
            ['src/generated/calc.impl.ts', `
import { Calc } from '../calc';
export class CalcImpl extends Calc {
    public add(a: number, b: number): number { return a + b; }
}
`],
        );
        generateContainer(dir);
        const code = containerContent(dir);
        expect(code).toContain("'Calc': CalcImpl");
        expect(code).toContain('CalcImpl');
        expect(code).toContain("import { CalcImpl }");
    });

    // 2. 多个 impl → 全部出现在 ServiceMap
    test('能力2: 多个 impl → 全部出现在 container 的 ServiceMap', () => {
        const dir = makeProject(
            ['src/a.ts', `export abstract class ServiceA { public abstract doA(): void; }`],
            ['src/b.ts', `export abstract class ServiceB { public abstract doB(): void; }`],
            ['src/generated/a.impl.ts', `
import { ServiceA } from '../a';
export class ServiceAImpl extends ServiceA { public doA(): void {} }
`],
            ['src/generated/b.impl.ts', `
import { ServiceB } from '../b';
export class ServiceBImpl extends ServiceB { public doB(): void {} }
`],
        );
        generateContainer(dir);
        const code = containerContent(dir);
        expect(code).toContain('ServiceAImpl');
        expect(code).toContain('ServiceBImpl');
        expect(code).toContain("'ServiceA'");
        expect(code).toContain("'ServiceB'");
    });

    // 3. @AutoGen 依赖 → factory 中自动注入
    test('能力3: @AutoGen 属性 → 在 factory 中出现 instance.dep = this.get(\'Dep\')', () => {
        const dir = makeProject(
            ['src/dep.ts', `
export abstract class Dep {
    public abstract ping(): void;
}
`],
            ['src/svc.ts', `
import type { Dep } from './dep';
// @autogen
export abstract class MainSvc {
    // @AutoGen
    public dep?: Dep;
    public abstract run(): void;
}
`],
            ['src/generated/dep.impl.ts', `
import { Dep } from '../dep';
export class DepImpl extends Dep { public ping(): void {} }
`],
            ['src/generated/mainsvc.impl.ts', `
import { MainSvc } from '../svc';
export class MainSvcImpl extends MainSvc { public run(): void {} }
`],
        );
        generateContainer(dir);
        const code = containerContent(dir);
        // factory 里应该注入 dep
        expect(code).toContain('instance.dep');
        expect(code).toContain("this.get('Dep')");
    });

    // 4. 生成的文件包含必要的头部注释（标记为自动生成，禁止手动修改）
    test('能力4: container.ts 包含 DO NOT EDIT 头部注释', () => {
        const dir = makeProject(
            ['src/s.ts', `export abstract class S { public abstract go(): void; }`],
            ['src/generated/s.impl.ts', `
import { S } from '../s';
export class SImpl extends S { public go(): void {} }
`],
        );
        generateContainer(dir);
        const code = containerContent(dir);
        expect(code).toContain('DO NOT EDIT');
    });

    // 5. 无 impl 文件 → 不崩溃，不生成 container.ts
    test('能力5: 无 impl 文件 → 不崩溃', () => {
        const dir = makeProject(); // 空项目，generated/ 目录存在但无 impl
        expect(() => generateContainer(dir)).not.toThrow();
        // container.ts 不应被创建
        const containerPath = path.join(dir, 'src', 'generated', 'container.ts');
        expect(fs.existsSync(containerPath)).toBe(false);
    });

    // 6. 生成的 container.ts 包含 singleton 逻辑（不重复实例化）
    test('能力6: container 实现 singleton（实例缓存逻辑存在）', () => {
        const dir = makeProject(
            ['src/db.ts', `export abstract class DB { public abstract save(k: string, v: any): void; }`],
            ['src/generated/db.impl.ts', `
import { DB } from '../db';
export class DBImpl extends DB { public save(k: string, v: any): void {} }
`],
        );
        generateContainer(dir);
        const code = containerContent(dir);
        // Singleton 模式：有 instances Map 和缓存判断
        expect(code).toContain('instances');
        expect(code).toContain('has(');
    });

    // 7. 不存在的 tsconfig → 抛出有意义的错误
    test('能力7: 项目无 tsconfig.json → 抛出 Error，不静默失败', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesc-cg-notsconfig-'));
        tempDirs.push(dir);
        fs.mkdirSync(path.join(dir, 'src', 'generated'), { recursive: true });
        // 故意不写 tsconfig.json
        expect(() => generateContainer(dir)).toThrow();
    });
});
