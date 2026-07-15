# PRD: AESC Module Config (`aesccfg.json`)

## 概述

为 AetherScript 引入**模块级配置文件** `aesccfg.json`，使 AESC 能正确处理不同目标环境（后端 Worker、前端浏览器插件）的代码生成差异，而无需修改 `// @autogen` 语法。

---

## 背景与动机

在 silent-piston 项目的实践中，我们发现 AESC 扫描到 `src/frontend/plugins/ITerminalPlugin.ts` 时，会将 impl 输出到 `src/generated/`，并尝试注册进 DI 容器——两件事都是错的。前端插件需要：

- 输出到 `src/frontend/plugins/`（而非 `src/generated/`）
- 不生成 DI 容器（而是通过 `await import()` 动态加载）
- 编译为浏览器 JS（而非 Node/Workers 环境）
- 使用 Playwright E2E 测试（而非 bun unit test）

这些差异本质上是**模块/目标环境的元数据**，不应该编码进 `// @autogen` 注释语法，而应该通过独立的配置文件表达。

---

## 用户故事

**作为 AI Agent**，当我在 `src/frontend/plugins/` 目录下创建了一个带 `// @autogen` 的 abstract class 后，我希望 `aesc-gen` 能自动把 impl 放到正确的目录，不生成无意义的 DI 容器代码，并在生成完毕后提示我需要运行 `bun run build:frontend` 来编译。

**作为人类开发者**，我希望对已有项目零修改——没有 `aesccfg.json` 的目录使用和现在完全一样的行为。

---

## 功能边界

### 必须实现 (MVP)

- `aesccfg.json` schema 定义（5个字段）
- Scanner：就近查找 `aesccfg.json`（当前目录 → 父目录 → 项目根，找到即止）
- Scanner：将 config 信息写入 `.aesc-scan.json` 的每个 entry
- aesc-gen：使用 entry 中的 `outputPath` 而非硬编码 `src/generated/`
- aesc-gen：根据 `generateDI` 决定是否生成/更新 `container.ts`
- aesc-gen：生成完毕后打印 `postGenHints`
- aesc-test：根据 `testType` 决定生成 unit（bun test）还是 e2e（Playwright）测试骨架
- 向后兼容：无 `aesccfg.json` 时使用默认值（= 当前行为）

### 不在范围内

- `// @autogen target=xxx` 语法变更（不需要）
- GUI 配置界面
- 多 `aesccfg.json` 合并（就近找到即止，不做继承链）
- 构建命令自动执行（只提示，不执行）

---

## 配置 Schema

```json
{
  "outputPath": "src/generated/",
  "generateDI": true,
  "testDir": "test/",
  "testType": "unit",
  "postGenHints": []
}
```

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `outputPath` | `string` | `"src/generated/"` | impl 文件输出目录（相对项目根） |
| `generateDI` | `boolean` | `true` | 是否更新 `container.ts` DI 注册 |
| `testDir` | `string` | `"test/"` | 测试文件输出目录 |
| `testType` | `"unit" \| "e2e"` | `"unit"` | 测试风格：unit=bun test，e2e=Playwright |
| `postGenHints` | `string[]` | `[]` | 生成完毕后打印的提示信息 |

### 示例：后端模块（默认，可省略 aesccfg.json）
```json
{
  "outputPath": "src/generated/",
  "generateDI": true,
  "testDir": "test/",
  "testType": "unit",
  "postGenHints": []
}
```

### 示例：前端插件模块
```json
{
  "outputPath": "src/frontend/plugins/",
  "generateDI": false,
  "testDir": "test/",
  "testType": "e2e",
  "postGenHints": [
    "Run: bun run build:frontend  (compile TS → public/plugins/xxx.js)",
    "Register the plugin in src/frontend/terminal.ts with: await import('/plugins/xxx.js')"
  ]
}
```

---

## 业务规则

1. Scanner 扫到 `// @autogen` class 时，取该文件的所在目录，向上查找 `aesccfg.json`，找到即止，未找到使用默认值。
2. 查找路径穿越保护：`outputPath` 必须是相对路径且不包含 `..`；aesc-gen 拒绝执行并报错。
3. `.aesc-scan.json` 中每个 class entry 新增 `moduleConfig` 字段，存储实际生效的配置（已合并默认值）。
4. 当 `generateDI: false` 时，aesc-gen **不修改** `container.ts`，也不创建它。
5. `postGenHints` 在 aesc-gen 完成所有文件生成后，逐行打印到 stdout，前缀为 `💡 hint:`。

---

## 边界条件

- **`aesccfg.json` 格式错误**：JSON.parse 失败时，报错并终止，不使用默认值（防止静默错误）。
- **`outputPath` 目录不存在**：aesc-gen 自动创建，与现有行为一致。
- **同一目录多个 `// @autogen` class**：共享同一份 `aesccfg.json`，行为一致。
- **`testType: "e2e"` 的 unit 测试框架**：aesc-test 生成 Playwright 骨架而非 bun test 文件，顶部加注释说明需要 `playwright.config.ts`。

---

## 安全要求

- `outputPath` 必须是相对路径，禁止绝对路径和 `..` 跳转，防止路径穿越写文件。
- `aesccfg.json` 中的 `postGenHints` 只用于 console 打印，不作为 shell 命令执行。

---

## 非功能需求

- **向后兼容**：不修改现有项目的任何行为（无 config = 默认值）。
- **性能**：查找 `aesccfg.json` 为同步文件读取，扫描性能影响可忽略。
- **实现复杂度**：预计改动文件：`scanner.ts`、`post-processor.ts`（aesc-gen）、aesc-test 相关逻辑，约 150-200 行新增。
