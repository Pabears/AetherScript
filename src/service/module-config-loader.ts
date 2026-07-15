// @autogen
import type { AescModuleConfig } from './module-config.ts';

/**
 * IModuleConfigLoader — aesccfg.json 读取与解析服务
 *
 * 由 AetherScript 舰队设计 (arch + qa + sec 三巨头审定)
 *
 * 架构决策：
 * - [arch] 就近查找策略：从给定目录向上冒泡直到项目根，找到即止，不合并多层配置
 * - [arch] 类型安全：返回 AescModuleConfig 而非 `any`，所有字段均有默认值
 * - [qa]   JSON 解析失败时抛出 ConfigParseError 而非静默降级，防止用错配置发布
 * - [sec]  outputPath 路径穿越校验在此层完成，上层调用者无需重复校验
 */
export abstract class IModuleConfigLoader {

    /**
     * 从给定的文件路径（abstract class 文件）向上查找 aesccfg.json，
     * 返回找到的配置（已合并默认值），若未找到则返回纯默认配置。
     *
     * @description
     * 实现步骤（按序执行）：
     * 1. 取 `abstractClassFilePath` 的目录（dirname）作为起始搜索目录
     * 2. 在起始目录查找 `aesccfg.json`，存在则读取并跳至步骤 5
     * 3. 若不存在，取父目录，重复步骤 2；直到到达 `projectRoot` 为止
     * 4. 若到达 `projectRoot` 仍未找到，返回 DEFAULT_MODULE_CONFIG
     * 5. 读取文件内容，用 JSON.parse 解析；解析失败抛出 ConfigParseError
     * 6. 对解析结果做字段校验（见 @edge-cases）
     * 7. 将用户配置与 DEFAULT_MODULE_CONFIG 合并（用户值优先）
     * 8. 对 outputPath 做路径安全校验（见 @security）
     * 9. 返回合并后的完整 AescModuleConfig
     *
     * @param abstractClassFilePath - abstract class 文件的绝对路径
     *   (例: "/project/src/frontend/plugins/ITerminalPlugin.ts")
     * @param projectRoot - 项目根目录的绝对路径，查找不超过此边界
     *   (例: "/project")
     *
     * @returns 生效的 AescModuleConfig（已合并默认值）
     *
     * @throws {ConfigParseError} 当 aesccfg.json 存在但 JSON 格式无效时
     * @throws {ConfigValidationError} 当 outputPath 包含路径穿越（".."）或绝对路径时
     *
     * @security outputPath 必须通过以下校验，否则抛出 ConfigValidationError：
     *   - 不得为绝对路径（不得以 "/" 或盘符开头）
     *   - 不得包含 ".." 路径段
     *   - postGenHints 仅用于打印，实现时绝不得作为 shell 命令执行
     *
     * @performance 文件读取为同步操作（Scanner 本身是同步流程），对扫描性能影响可忽略
     *
     * @edge-cases
     *   - aesccfg.json 中出现未知字段：忽略，不报错（宽松解析）
     *   - aesccfg.json 中字段类型错误（如 generateDI 为字符串）：抛出 ConfigValidationError
     *   - 同一目录有多个 abstract class：共享同一份 aesccfg.json，行为一致
     *   - projectRoot 本身有 aesccfg.json：正常读取，这是合法的全局默认配置
     */
    public abstract load(
        abstractClassFilePath: string,
        projectRoot: string
    ): AescModuleConfig;
}
