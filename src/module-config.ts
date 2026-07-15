/**
 * AescModuleConfig — aesccfg.json 的 TypeScript 类型定义
 *
 * 每个 AESC 模块目录下可放置 aesccfg.json 来声明该目录的生成策略。
 * Scanner 查找时从 abstract class 所在目录向上冒泡，找到即止。
 * 未找到时使用 DEFAULT_MODULE_CONFIG（= 当前行为，向后兼容）。
 */
export interface AescModuleConfig {
    /**
     * impl 文件的输出目录，相对于项目根路径。
     * 不得包含 ".." 或绝对路径（安全校验）。
     * @example "src/generated/"         (后端，默认)
     * @example "src/frontend/plugins/"  (浏览器插件)
     */
    outputPath: string;

    /**
     * 是否将生成的 impl 注册进 DI 容器（container.ts）。
     * 前端插件通过 dynamic import() 加载，不需要 DI。
     * @default true
     */
    generateDI: boolean;

    /**
     * 测试文件的输出目录，相对于项目根路径。
     * @default "test/"
     */
    testDir: string;

    /**
     * 测试风格，影响 aesc-test 生成的测试框架。
     * - "unit": 生成 bun test 格式（适合后端 Worker 服务）
     * - "e2e":  生成 Playwright 格式（适合前端浏览器插件）
     * @default "unit"
     */
    testType: 'unit' | 'e2e';

    /**
     * 测试执行命令。由 AetherScript Agent 在生成测试后自动执行。
     * 例如："bun test" 或 "bun run test:e2e"
     */
    testCommand?: string;

    /**
     * aesc-gen 完成所有文件生成后，逐行打印到 stdout 的提示信息。
     * 用于提醒开发者需要手动执行的后续步骤（如 build、注册）。
     * 仅用于 console 打印，不作为 shell 命令执行。
     * @example ["Run: bun run build:frontend", "Register plugin in terminal.ts"]
     * @default []
     */
    postGenHints: string[];
}

/** 默认配置 = 当前行为，确保向后兼容 */
export const DEFAULT_MODULE_CONFIG: AescModuleConfig = {
    outputPath: 'src/generated/',
    generateDI: true,
    testDir: 'test/',
    testType: 'unit',
    postGenHints: [],
};
