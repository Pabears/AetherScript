# AetherScript 开发工作流

## 核心概念：每个 Service 的生命周期状态

```
NO_CONTRACT ──(aesc-pre)──► PRD_DEFINED ──(aesc-ad)──► CONTRACT_DEFINED
                                                             │
                                                        (aesc-build)
                                                        (Mega-Batch + Blind Judge)
                                                             │
                                                             ▼
                                                        TESTED_IMPL ──(lock)──► IMPL_LOCKED
                                                             ▲                       │
                                                             │                  (unlock)
                                                             └───────────────────────┘
```

五个核心状态：

| 状态 | 含义 | 下一步 |
|------|------|--------|
| `NO_CONTRACT` | 什么都没有 | `aesc-pre` 挖掘需求 |
| `PRD_DEFINED` | 需求已定论 (Append-only) | `aesc-ad` 推演架构 |
| `CONTRACT_DEFINED` | Abstract Class 契约已生成，待实现 | `aesc-build` |
| `TESTED_IMPL` | 经过 Mega-Batch 并发盲写，且盲审通过，全部测试绿灯 | 稳定，可交付 / 遇到特殊需求时 lock |
| `IMPL_LOCKED` | impl 已被手动修改并锁定，免受下次覆盖 | 稳定 / unlock 重新交由 AI 接管 |

---

## 工具触发决策树

```
你现在要做什么？
│
├─ 全新功能，只有一个粗略的想法
│   └─ → aesc-pre（五巨头 PK → 产出 PRD）
│
├─ PRD 已经有了，需要设计接口结构
│   └─ → aesc-ad（读取 PRD → 产出高标准 Abstract Class 契约）
│
├─ Abstract Class 契约已经就绪（无论是手写还是 aesc-ad 生成）
│   ├─ 需要代码实现和黑盒测试
│   └─ → aesc-build（启动影子宇宙并发盲写、AST 校验和闭环盲审法官）
│
├─ impl 有极端 bug 大模型修不好，需要手动修
│   ├─ Step 1: 手动编辑 impl 文件
│   ├─ Step 2: bun test → 确认修复
│   └─ Step 3: lock → 防止下次 aesc-build 覆盖修复
│
├─ Abstract Class JSDoc 小改（补充说明，如细化边界条件）
│   ├─ unlock (如果锁定了)
│   └─ → aesc-build（重新并行拉起，测试和实现自动校准）
│
├─ 只想查看当前项目的 abstract class 列表
│   └─ → bun run scan（仅扫描）
│
└─ 删除一个 Service
    ├─ Step 1: unlock（如果已 lock）
    ├─ Step 2: 删除 src/service/<name>-service.ts 等相关文件
    └─ Step 3: bun run scan && bun src/container-gen.ts
```

---

## 5 个标准场景

### 🟢 Scenario A：全新 Service 全生命周期

```bash
# Phase 1: 需求挖掘
# → 触发 aesc-pre skill（五巨头拷问→产出 PRD）

# Phase 1.5: 架构设计桥梁
# → 触发 aesc-ad skill（基于 PRD 推演出 Abstract Class 契约）
# ⏸ 人类门控：执行 tsc --noEmit 检查，并审核 Abstract Class 设计是否满意

# Phase 2: Mega-Batch 闭环生成
# → 触发 aesc-build 脚本
bun src/scanner.ts --project .          # Step 1: 扫描契约
bun src/aesc-build.ts --project .       # Step 2: 影子宇宙盲写 + 并行测试 + 盲审纠错
# ✅ aesc-build 结束时，必定 Exit 0 且单元测试全部通过。
```

---

### 🟡 Scenario B：JSDoc 契约小修补

业务逻辑未变，但发现测试覆盖不够，或者边界情况考虑不周：

```bash
# 1. 人类直接修改 Abstract Class 的 JSDoc，增加 @edge-cases 描述
# 2. 如果之前 lock 了这个服务，先 unlock
bun src/lock-manager.ts unlock src/generated/<name>.impl.ts

# 3. 再次全量启动闭环流水线
bun src/scanner.ts --project .
bun src/aesc-build.ts --project .
# aesc-build 的 Blind Judge 会发现现有的 impl 和新的测试契约不匹配，并自动打回给 Agent 修复 impl。
```

---

### 🔴 Scenario C：手动接管边界情况 (The Human Override)

有时候因为底层框架或者极其特殊的二进制处理，大模型在 `aesc-build` 的重试 3 次中仍然失败，盲审法官直接判死刑退出。

```bash
# 1. 确认 aesc-build 由于大模型能力上限退出报错。
# 2. 人类介入，手动修改 src/generated/<name>.impl.ts
vim src/generated/<name>.impl.ts

# 3. 运行测试确认
bun test

# 4. 立即锁定，防止后续再次被 AI 的幻觉覆盖
bun src/lock-manager.ts lock src/generated/<name>.impl.ts
```

---

### 🔧 Scenario D：删除/重命名 Service

```bash
# 1. 解锁（如果 locked）
bun src/lock-manager.ts unlock src/generated/<name>.impl.ts

# 2. 删除文件
rm src/service/<name>-service.ts
rm src/generated/<name>.impl.ts
rm test/<name>.test.ts

# 3. 必须重新生成 DI 容器并确保项目可构建
bun src/scanner.ts --project .
bun src/container-gen.ts --project .
bun test
```

---

## 核心工作流组件说明

| 工具 / 脚本 | 职责与触发时机 | 幂等 / 危险性 |
|-------------|---------|--------|
| **aesc-pre** | 5人组 PK，挖掘真实需求，产出 append-only 的 PRD。 | ✅ 纯文本输出 |
| **aesc-ad** | 读取 PRD，推演系统架构，产出带详细 JSDoc 的 `.ts` 契约。| ✅ 人工干预修改 |
| **aesc-build** | **系统引擎心脏**。基于现有契约，启动并行盲写与验收。内部集成 `post-processor`、`container-gen` 和 `aesc-test` 逻辑，处理 AST 冲突与测试碰撞。 | ⚠️ 覆盖未锁定的 impl 和 test |
| **lock** | 手动修改 impl 后的自我保护声明。 | ✅ 幂等 |

---

## 黄金规则 (Golden Rules)

1. **绝对隔离 (Blind Generation)**：在任何扩展插件中，写测试和写实现必须处于不同的上下文（影子宇宙），杜绝 AI 互相对串改答案。
2. **人类管契约，AI 管实现**：出了 bug，第一时间去排查 Abstract Class 的 JSDoc 是否有遗漏，而不是去改 impl（除非你要放弃 AI 接管并 lock）。
3. **Lock 必跟随 Git**：手改 impl 必须连同 `aesc.lock` 一起提交，这是向全世界声明“这块代码由人类保护”。
4. **编译与测试就是真理**：能通过 TypeScript 严格模式编译和黑盒业务测试的代码，无论 AI 写的有多丑，在流水线眼中就是“好的”代码。

---

## Git 联防机制

### 为什么 `aesc.lock` 要提交到 git？

`aesc.lock` **不在 `.gitignore` 中**，必须随代码一起提交。

| 如果不提交 aesc.lock | 如果提交 aesc.lock |
|---------------------|------------------|
| A 锁了 impl，B pull 后不知道 | B pull 后自动获得正确的 lock 状态 |
| B 跑 aesc-build，A 的手改被覆盖 | aesc-build 自动跳过已 lock 的文件 |
| 团队协作时无法共享保护状态 | lock 状态随代码版本化管理 |

### Git Hooks（自动安装）

```bash
bash scripts/setup-hooks.sh   # 新克隆仓库后运行一次
```

三个 hooks 覆盖三种破坏场景：

| Hook | 触发时机 | 保护内容 |
|------|---------|---------|
| `pre-commit` | `git commit` | impl 已改但未 lock → **阻断提交**，要求先 lock |
| `post-merge` | `git pull / merge` | impl 文件随 pull 变化 → **提醒**检查 lock 状态 |
| `post-checkout` | `git switch` | 切分支导致 impl 变化 → **提醒**检查 lock 状态 |
