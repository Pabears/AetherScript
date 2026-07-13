/**
 * post-processor.test.ts — aesc post-processor 回归测试
 *
 * 测试策略：
 *   - 在真实临时项目中创建 abstract class + impl 文件
 *   - 验证每种修复能力和通过情况
 */
import { test, describe, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { postProcessFile } from '../src/post-processor';

// ─── Temp Project Helpers ────────────────────────────────────

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

function makeProject(...files: Array<[string, string]>): { dir: string; project: Project } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aesc-pp-'));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'src', 'generated'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), TSCONFIG);
    for (const [relPath, content] of files) {
        const abs = path.join(dir, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    const project = new Project({ tsConfigFilePath: path.join(dir, 'tsconfig.json') });
    return { dir, project };
}

// ─── Tests ───────────────────────────────────────────────────

describe('PostProcessor 回归测试', () => {

    // 1. 正确的 impl → success:true, fixed:false, errors:[]
    test('能力1: 合法的 impl 文件 → success=true，不做修改', () => {
        const { dir, project } = makeProject(
            ['src/base.ts', `
export abstract class Calculator {
    public abstract add(a: number, b: number): number;
}
`],
            ['src/generated/calculator.impl.ts', `
import { Calculator } from '../base';
export class CalculatorImpl extends Calculator {
    public add(a: number, b: number): number {
        return a + b;
    }
}
`],
        );
        const implPath = path.join(dir, 'src/generated/calculator.impl.ts');
        const result = postProcessFile(implPath, project);
        expect(result.success).toBe(true);
        expect(result.fixed).toBe(false);
        expect(result.errors).toHaveLength(0);
    });

    // 2. implements AbstractClass → 修复为 extends
    test('能力2: "implements AbstractBase" → 自动修复为 "extends AbstractBase"', () => {
        const { dir, project } = makeProject(
            ['src/svc.ts', `
export abstract class AbstractSvc {
    public abstract run(): string;
}
`],
            ['src/generated/svc.impl.ts', `
import { AbstractSvc } from '../svc';
export class AbstractSvcImpl implements AbstractSvc {
    public run(): string { return 'ok'; }
}
`],
        );
        const implPath = path.join(dir, 'src/generated/svc.impl.ts');
        const result = postProcessFile(implPath, project);
        expect(result.fixed).toBe(true);
        // 修复后文件内容不含 implements AbstractSvc
        const fixedContent = fs.readFileSync(implPath, 'utf-8');
        expect(fixedContent).toContain('extends AbstractSvc');
        expect(fixedContent).not.toContain('implements AbstractSvc');
    });

    // 3. 重复声明基类 property → 自动删除
    test('能力3: impl 中重复声明基类 property → 自动删除', () => {
        const { dir, project } = makeProject(
            ['src/base-with-prop.ts', `
function AutoGen(t: any, k: string) {}
export abstract class ServiceWithProp {
    @AutoGen
    public helper?: any;
    public abstract work(): void;
}
`],
            ['src/generated/servicewithprop.impl.ts', `
import { ServiceWithProp } from '../base-with-prop';
export class ServiceWithPropImpl extends ServiceWithProp {
    public helper?: any;       // ← AI 重复声明了 base class 的 property
    public work(): void {}
}
`],
        );
        const implPath = path.join(dir, 'src/generated/servicewithprop.impl.ts');
        const result = postProcessFile(implPath, project);
        expect(result.fixed).toBe(true);
        const fixedContent = fs.readFileSync(implPath, 'utf-8');
        // helper 声明应被删除（但 work 方法保留）
        const lines = fixedContent.split('\n').filter(l => l.includes('helper?: any'));
        expect(lines).toHaveLength(0);
        expect(fixedContent).toContain('work()');
    });

    // 4. 文件不存在 → success:false + 有错误信息
    test('能力4: 文件不存在 → success=false，errors 包含提示', () => {
        const { project } = makeProject();
        const result = postProcessFile('/tmp/totally-nonexistent-abc123.ts', project);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('not found');
    });

    // 5. 有真实编译错误（调用不存在方法）→ success:false
    test('能力5: impl 有编译错误 → success=false，errors 包含错误描述', () => {
        const { dir, project } = makeProject(
            ['src/calc.ts', `export abstract class Calc { public abstract compute(): number; }`],
            ['src/generated/calc.impl.ts', `
import { Calc } from '../calc';
export class CalcImpl extends Calc {
    public compute(): number {
        return this.undefinedMethod(); // 调用了不存在的方法
    }
}
`],
        );
        const implPath = path.join(dir, 'src/generated/calc.impl.ts');
        const result = postProcessFile(implPath, project);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    // 6. PostProcessResult 结构完整
    test('能力6: 返回结果包含所有规定字段', () => {
        const { dir, project } = makeProject(
            ['src/s.ts', `export abstract class S { public abstract ping(): void; }`],
            ['src/generated/s.impl.ts', `
import { S } from '../s';
export class SImpl extends S { public ping(): void {} }
`],
        );
        const implPath = path.join(dir, 'src/generated/s.impl.ts');
        const result = postProcessFile(implPath, project);
        expect(typeof result.filePath).toBe('string');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.fixed).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
    });
});
