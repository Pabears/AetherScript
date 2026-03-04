# AetherScript Fleet

> 一套用多角色 AI 舰队协作生成高质量代码的工程方法论。

## 这是什么

AetherScript Fleet 是在 OpenClaw 多 agent 框架下，通过真实项目实战（自我重写）迭代出来的 **AI 协作代码生成方法论**。

核心价值不是某个具体的代码实现，而是**如何组织多个 AI 角色协作、互相制衡、输出高质量结果**的完整 playbook。

## 读这个

👉 [`docs/FLEET_ARCHITECTURE.md`](docs/FLEET_ARCHITECTURE.md)

包含：
- 三个核心原则
- 五大角色定义与模型分配
- 完整7步流程（aesc-pre / aesc-gen / aesc-test）
- Sub-agent 运行规范（Output 预算、并行策略、生成与写入分离）
- 版本演进记录（为什么这么设计，踩过什么坑）

## 语言无关

虽然命名来自 TypeScript 实验背景，但方法论本身适用于任何语言：Python、Java、Rust、Go……
约束 LLM output、抽象粒度门禁、TDD、外部锚点——这些原则跟语言无关。
