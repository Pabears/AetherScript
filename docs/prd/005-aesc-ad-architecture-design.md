# PRD 005: AESC-AD (Architecture Design) 架构设计桥梁

## 概述
`aesc-ad` 是 AetherScript 流水线中的核心“高级桥梁”，负责将非结构化的 PRD（Append-Only）精准转换为结构化的、带有 `@autogen` 和详尽 JSDoc 的 TypeScript Abstract Classes。这是人类架构师把控系统设计的最后一环，也是人类可读代码的极限边界。

## 用户故事
作为一名架构师，我希望在编写完精简的小型 PRD 后，调用高级大模型（如 Gemini 3.1 Pro）通过 CoT（思维链）自动在现有架构上推演出修改方案，并生成或更新 Abstract Classes。我希望该工具具备极高的“架构品味”，能果断拒绝逻辑混乱的垃圾 PRD，并确保单次修改不超过 7 个类，以便我进行最终的绝对掌控和人工 Code Review。审核通过且通过 tsc 语法编译后，再由 `aesc-gen` 接管生成机器代码。

## 功能边界
### 必须实现 (MVP)
- **输入与校验**：读取指定的 PRD 文件和现有的 Abstract Classes 上下文。
- **高傲的拒绝机制**：大模型需要先进行逻辑自洽性检查，发现 PRD 是“垃圾”（矛盾、缺失核心逻辑）时直接抛出 Error 并拒绝生成。
- **CoT 推演与生成**：使用顶级模型，输出更新后的 Abstract Classes（包含 `@autogen`、方法签名、精细的 JSDoc）。
- **修改阈值熔断**：单次请求如果推断需要修改/新建超过 7 个类，立即熔断并提示“架构变更过大，请拆解 PRD”。
- **语法前置防线**：在交给 `aesc-gen` 前，必须通过 TypeScript 编译检查，保证语法绝对正确。

### 不在范围内
- 自动拆解巨型 PRD（长远目标是 Map-Reduce，但 MVP 阶段交由人工拆分）。
- 直接生成实现代码（那是 `aesc-gen` 的工作，AD 层只负责契约）。

## 数据模型
- **输入**：`PRD (Markdown)` + `Context (Current Abstract Classes & Entities)`
- **输出**：`Abstract Class (.ts)` + `Entity (.ts)`
- **中间态**：`CoT 架构推理日志 (JSON/Text)`

## 业务规则
1. **Append-Only 到 Mutable 的转换**：PRD 是不断追加的文档，但生成的 Abstract Class 必须是就地更新（Mutable）的，体现系统的当前最新真实状态。
2. **人类强制审核门控 (Human Review Gate)**：生成的 Abstract Class 绝不自动流入下个环节。必须由人类架构师确认后，手动触发后续 Pipeline。
3. **架构品味校验**：Prompt 中必须注入“高级架构师品味”的准则（如高内聚低耦合、SOLID 原则），并在 CoT 阶段强制打分，低于阈值直接报错退出。

## 边界条件
- **类的数量超限**：如需修改 >= 8 个类，触发 Map-Reduce 提示，要求用户提交子模块 PRD。
- **编译失败**：生成的 Abs Class 即使差一个括号，流水线也会在语法检查阶段阻断。
- **死循环/幻觉**：CoT 推理步数设置上限，防止过度发散。

## 安全要求
- 危险动作（如涉及到高危权限的类修改），系统需在控制台高亮输出警告，强制人类架构师进行二次确认。
- 绝不执行 PRD 中包含的任何 Shell 或系统级恶意指令（纯文本到文本的转换）。

## 非功能需求
- **模型要求**：强制绑定高推理算力模型（Gemini 3.1 Pro / Claude 3.5 Sonnet / Opus）。
- **可插拔性**：MVP 阶段以 Agent Skill 形式存在，后续集成到 AetherScript 核心 CLI 中。
