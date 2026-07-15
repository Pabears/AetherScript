# PRD 004: Mega-Batch Automation Architecture

## 1. 背景与动机 (Context & Motivation)

在 AetherScript 的早期版本中，我们采用了“单类触发”的代码生成模式。不论是生成具体实现 (`aesc-gen`) 还是生成测试代码 (`aesc-test`)，系统都会为每个被扫描到的类单独启动一次 `agy` Agent 会话。
虽然这种模式隔离性极高，但暴露出了两个致命问题：
1. **Token 消耗巨大，执行效率低下**：每次启动新的 Agent 会话都需要重新加载庞大的项目系统级 Prompt（包括核心指令、代码规范等），导致极大的浪费。
2. **自动化程度不足**：早期的 `aesc-gen` 严重依赖人为唤起内置的 Agent Skill，无法做到类似编译器的流水线无缝执行。

## 2. 目标 (Goal)

彻底颠覆过去的“手工作坊”模式，构建一个 **100% 自动化的工业级“契约到代码”流水线**。
核心理念是：**“巨型 Prompt 批处理 (Mega-Batch Prompting)” + “外层闭环自愈 (Outer Validation Loop)”**。

我们将把所有离散的契约打包一次性喂给顶配大模型，然后利用 TypeScript 和底层的强类型/测试框架作为“机械化验收标准”，自动捕获大模型的失误并打回重造，直到通过验收。

## 3. 架构设计 (Architecture)

### 3.1 巨型批处理 (Mega-Batch Prompting)
无论是 `src/aesc-gen.ts` 还是 `src/aesc-test.ts`，脚本都会读取 `.aesc-scan.json`，将当前所有待处理的类（及其完整 JSDoc 契约、类型依赖源码）拼接成一个高密度、超大信息量的 Prompt 数组。
通过 `execFileSync` 唤起带有 `--dangerously-skip-permissions` (YOLO) 模式的高配 Agent（如 `Gemini 3.5 Flash (High)`），命令其在同一个会话中一次性写出所有需要的 `.impl.ts` 或 `.test.ts` 文件。

### 3.2 验收闭环与自愈引擎 (Outer Validation Loop)
当 Agent 的批处理任务结束后，外层的 TypeScript 主控脚本将立即启动**刚性校验**：
- **在 `aesc-gen.ts` 中**：自动调起 `post-processor.ts`。利用 `ts-morph` 进行抽象语法树 (AST) 级别的强制比对，检查大模型是否漏写了方法、是否破坏了入参类型、是否遗漏了 `@throws` 分支的断言。
- **在 `aesc-test.ts` 中**：自动调起 `bun test` 进行黑盒运行。

**自愈机制 (Self-Healing)**：
如果任何文件缺失、AST 校验失败、或单元测试飘红，主控脚本将捕获精确的 Stderr 报错信息和缺失类的列表，自动组装成一份“修复型 Prompt”，将其重新打回给 Agent，并允许最高 3 次的重试（Max Retries）。直到所有约束全部满足（Exit Code 0）才结束流转。

## 4. 全链路工作流 (End-to-End Workflow)

如今，AetherScript 的“编译级”工作流已浓缩为无需人工干预的纯机械化管道：

```bash
bun run scan             # 1. 扫描 JSDoc，生成 AST 契约
bun run aesc-gen         # 2. 批处理生成 Impl 业务代码，进行 AST 刚性验证
bun run gen-container    # 3. 组装依赖注入 (DI) 容器
bun run aesc-test        # 4. 批处理生成测试代码，进行 Bun Test 闭环验证
```

## 5. 核心价值 (Value Delivered)
1. **机械运动与智能化水乳交融**：充分利用了 LLM 泛化理解复杂业务边界（JSDoc）的灵活性，同时用坚固的 TS/Shell 齿轮（AST 验证/单元测试）锁死了代码绝对准确的下限。
2. **极速与低成本**：得益于合并的 Mega-Batch Context，大模型只需理解一遍系统背景即可完成整个项目的逻辑重构。
3. **彻底释放架构师**：人类从此只需要专注于编写 Abstract Class 的接口协议和 `@edge-cases`，从无聊的实现与排错中 100% 解放。
