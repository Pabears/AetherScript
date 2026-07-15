/**
 * module-config-loader.test.ts — IModuleConfigLoader 回归测试
 *
 * 测试通过创建真实的临时文件和目录，验证：
 * 1. 就近查找（dirname 开始向上查找）
 * 2. 向上冒泡边界（不超过 projectRoot）
 * 3. 默认配置回退
 * 4. 配置合并规则
 * 5. JSON 解析错误处理（ConfigParseError）
 * 6. 字段类型校验（ConfigValidationError）
 * 7. 路径穿越与绝对路径安全校验（ConfigValidationError）
 */
import { test, describe, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { IModuleConfigLoaderImpl, ConfigParseError, ConfigValidationError } from '../src/generated/imoduleconfigloader.impl';
import { DEFAULT_MODULE_CONFIG } from '../src/module-config';

const loader = new IModuleConfigLoaderImpl();
const tempDirs: string[] = [];

afterEach(() => {
    for (const d of tempDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

function createTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}

describe('IModuleConfigLoader 回归测试', () => {

    test('1. 在起始目录查找到 aesccfg.json 并成功合并配置', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const configContent = {
            outputPath: 'custom/gen',
            generateDI: false,
            testDir: 'custom/test',
            testType: 'e2e',
            postGenHints: ['Hint 1', 'Hint 2']
        };

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify(configContent));

        const targetFile = path.join(sub, 'MyService.ts');
        const config = loader.load(targetFile, root);

        expect(config).toEqual({
            outputPath: 'custom/gen',
            generateDI: false,
            testDir: 'custom/test',
            testType: 'e2e',
            postGenHints: ['Hint 1', 'Hint 2']
        });
    });

    test('2. 在上层目录（父目录）查找到 aesccfg.json', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const configContent = {
            outputPath: 'parent/gen',
            generateDI: true
        };

        // 将配置文件写在 src/ 目录，而不是 src/service/
        fs.writeFileSync(path.join(root, 'src', 'aesccfg.json'), JSON.stringify(configContent));

        const targetFile = path.join(sub, 'MyService.ts');
        const config = loader.load(targetFile, root);

        expect(config).toEqual({
            ...DEFAULT_MODULE_CONFIG,
            outputPath: 'parent/gen',
            generateDI: true
        });
    });

    test('3. 到达 projectRoot 仍未找到配置，回退到 DEFAULT_MODULE_CONFIG', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const targetFile = path.join(sub, 'MyService.ts');
        const config = loader.load(targetFile, root);

        expect(config).toEqual(DEFAULT_MODULE_CONFIG);
    });

    test('4. projectRoot 本身存在 aesccfg.json，成功读取并合并', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const configContent = {
            outputPath: 'root/gen'
        };

        fs.writeFileSync(path.join(root, 'aesccfg.json'), JSON.stringify(configContent));

        const targetFile = path.join(sub, 'MyService.ts');
        const config = loader.load(targetFile, root);

        expect(config).toEqual({
            ...DEFAULT_MODULE_CONFIG,
            outputPath: 'root/gen'
        });
    });

    test('5. JSON 格式解析失败，抛出 ConfigParseError', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), '{ invalid json ');

        const targetFile = path.join(sub, 'MyService.ts');
        expect(() => {
            loader.load(targetFile, root);
        }).toThrow(ConfigParseError);
    });

    test('6. 宽松解析：未知字段忽略不报错', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const configContent = {
            outputPath: 'custom/gen',
            unknownField: 42,
            anotherUnknown: 'hello'
        };

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify(configContent));

        const targetFile = path.join(sub, 'MyService.ts');
        const config = loader.load(targetFile, root);

        expect(config.outputPath).toBe('custom/gen');
        expect((config as any).unknownField).toBeUndefined();
    });

    test('7. 字段类型错误校验，抛出 ConfigValidationError', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const targetFile = path.join(sub, 'MyService.ts');

        // generateDI 字段必须为 boolean
        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ generateDI: 'not-a-boolean' }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);

        // outputPath 字段必须为 string
        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ outputPath: 123 }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);

        // testDir 字段必须为 string
        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ testDir: true }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);

        // testType 字段必须为 "unit" 或 "e2e"
        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ testType: 'invalid-type' }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);

        // postGenHints 字段必须为 string[]
        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ postGenHints: 'not-an-array' }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ postGenHints: ['hint', 123] }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);
    });

    test('8. 路径安全校验：绝对路径拦截，抛出 ConfigValidationError', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const targetFile = path.join(sub, 'MyService.ts');

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ outputPath: '/absolute/path' }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);
    });

    test('9. 路径安全校验：路径穿越拦截，抛出 ConfigValidationError', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const targetFile = path.join(sub, 'MyService.ts');

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ outputPath: '../hacked' }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify({ outputPath: 'generated/../hacked' }));
        expect(() => loader.load(targetFile, root)).toThrow(ConfigValidationError);
    });

    test('10. 同一目录有多个 abstract class 共享同一份 aesccfg.json 且行为一致', () => {
        const root = createTempDir('aesc-cfg-');
        const sub = path.join(root, 'src', 'service');
        fs.mkdirSync(sub, { recursive: true });

        const configContent = {
            outputPath: 'shared/gen',
            generateDI: true
        };

        fs.writeFileSync(path.join(sub, 'aesccfg.json'), JSON.stringify(configContent));

        const targetFile1 = path.join(sub, 'ServiceOne.ts');
        const targetFile2 = path.join(sub, 'ServiceTwo.ts');

        const config1 = loader.load(targetFile1, root);
        const config2 = loader.load(targetFile2, root);

        expect(config1).toEqual(config2);
        expect(config1.outputPath).toBe('shared/gen');
    });
});
