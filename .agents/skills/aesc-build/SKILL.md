---
name: aesc-build
description: 启动 AetherScript 并行构建管线 (Parallel Gen + Test) 及盲审机制 (Blind Judge)
---

# `aesc-build` 技能指南

此技能用于在 `AetherScript` 架构下，针对更新的抽象类（Abstract Class）并发地生成实现（Implementation）和测试（Test）。

## 核心机制 (The Architecture)

1. **Shadow Workspaces (影子宇宙)**: `aesc-build` 会克隆目标项目的代码，分别在 `.aesc/shadow-gen/` 和 `.aesc/shadow-test/` 中并发拉起 `aesc-gen` 和 `aesc-test`。
2. **Blind Generation (盲写)**: 在此过程中，Test Agent 绝对看不到 Gen Agent 写的代码，反之亦然。这保证了它们只能根据 **Abstract Class (契约)** 来写代码。
3. **Merge & Clash (合并碰撞)**: 生成完毕后，代码将被拷贝回主干宇宙。此时运行 `bun test`。
4. **Blind Arbitration (盲审法官)**: 如果 `bun test` 失败，说明有人违背了契约！内置的 Judge Agent 会被唤醒进行审查，指出是谁的错。

## 使用场景

当 `aesc-ad` (架构设计) 阶段完成，抽象类 `.ts` 已经定稿并加了 `// @autogen` 标签。
你准备开始真正的全自动“代码生成+测试生成”闭环时，请使用此技能。

## 执行指令

在任何 AetherScript 目标项目中，执行以下命令：

```bash
# 确保提前运行了 scan 收集上下文
bun /path/to/AetherScript/src/scanner.ts --project .

# 启动并行构建和盲审
bun /path/to/AetherScript/src/aesc-build.ts --project .
```

如果出现法官 (Judge) 判定失败，你需要根据法官的输出手动决定下一步操作，绝不能通过“修改契约来迁就错误的实现”！
