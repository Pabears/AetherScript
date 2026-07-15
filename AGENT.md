# AetherScript 开发工作流指南

本文档为参与 aesc 项目开发的 Agent 提供工作规范和项目背景。

## 项目定位

aesc 是一套「AI-Assisted Development You Can Trust」工具链，核心哲学：

- **Abstract Class = 唯一真相来源**：人类定义契约（方法签名 + JSDoc），AI 只填实现
- **aesc-ad 架构防线**：拒绝逻辑混乱的垃圾 PRD，只产出高质量的 Abstract Class
- **Mega-Batch 与影子宇宙**：实现（impl）和测试（test）在不同的影子宇宙中由顶级大模型并发盲写，互不可见
- **盲审法官 (Blind Judge)**：测试和实现碰撞失败时，法官负责溯源纠错，取代人类 Debug

## 标注语法

```typescript
// @autogen                        ← 标记整个 abstract class 需要参与流水线
export abstract class UserService {
    // @AutoGen                    ← 标记属性需要 DI 注入（ts-morph 通过 getLeadingCommentRanges 识别）
    public db?: DB;

    public abstract create(user: User): void;
}
```

> ⚠️ **已废弃**：`@AutoGen` 装饰器（`import { AutoGen } from 'aesc'`）。一律使用注释语法。

## 工具链调用

```bash
bun src/scanner.ts --project <目标项目>         # 扫描 → .aesc-scan.json
bun src/aesc-build.ts --project <目标项目>      # 启动并行盲写与盲审管线 (Mega-Batch)
bun src/lock-manager.ts list                   # 查看已锁定文件
bun src/lock-manager.ts lock <file>            # 保护手动修改的 impl
bun src/lock-manager.ts unlock <file>          # 解锁
```

> `post-processor.ts` 和 `container-gen.ts` 已内置于 `aesc-build` 中，通常不再需要人工调用。

## 测试

```bash
bun test              # aesc 工具回归测试（包含 scanner, builder, parser 等）
bun run test:demo     # demo 黑盒测试
bun run test:all      # 全跑
```

## 目录结构

```
src/                  # 工具链（确定性，人类维护）
  aesc-build.ts       # 巨型批处理与盲审主控
test/                 # 工具链回归测试
demo/                 # 电商示例（7 服务）
  src/service/        # Abstract Class 契约（人类或 aesc-ad 定义）
  src/generated/      # impl + container（工具链生成，谨慎手改）
  test/               # 黑盒业务测试
.agents/skills/       # Antigravity Skills
  aesc-pre/           # 需求收集 (5角色 PK)
  aesc-ad/            # 架构推演 (PRD -> Abstract Class)
  aesc-build/         # 并发流水线与盲审 (Abstract Class -> impl & test)
  aesc-gen/           # (旧版单向管线，供部分独立使用)
  aesc-test/          # (旧版单向管线，供部分独立使用)
```

## 核心原则

1. **绝对禁止修改 `src/generated/` 中的文件**（除非先 lock），那些文件由工具链管理。
2. **Blind Generation 铁律**：负责写测试的 Agent 绝不能读取 `impl` 的代码，负责写实现的 Agent 也绝不能读取 `test` 的代码。它们唯一的交汇点只有 Abstract Class。
3. **改动工具链后必须重跑 `bun test`**，保持回归测试全绿。
4. **JSDoc 是 impl 和 test 生成的联合 Prompt**：越详细越好，`@description` 步骤编号、`@throws` 条件、`@edge-cases` 边界值缺一不可。
