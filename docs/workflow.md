# AetherScript 开发工作流

## 核心概念：每个 Service 有生命周期状态

```
NO_CONTRACT ──(aesc-pre)──► CONTRACT_DEFINED ──(aesc-gen)──► IMPL_FRESH ──(lock)──► IMPL_LOCKED
                                    ▲                              │                       │
                                    │                         (aesc-gen)              (unlock)
                                    │                              │                       │
                            (修改 JSDoc)                     IMPL_FRESH ◄────────────────┘
                                    │
                                    └── TESTED ◄──(aesc-test)── IMPL_FRESH / IMPL_LOCKED
                                           │
                                    (发现 bug)
                                           │
                                    手动修 impl → lock
```

五个状态：

| 状态 | 含义 | 下一步 |
|------|------|--------|
| `NO_CONTRACT` | 还没有 Abstract Class | aesc-pre |
| `CONTRACT_DEFINED` | 有 Abstract Class，但还没有 impl | aesc-gen |
| `IMPL_FRESH` | 有 AI 生成的 impl，从未手改 | aesc-test / lock |
| `IMPL_LOCKED` | impl 已被手动修改并锁定 | aesc-test / unlock |
| `TESTED` | aesc-test 全部通过 | 稳定，可交付 |

---

## 工具触发决策树

```
你现在要做什么？
│
├─ 全新功能，需要设计接口
│   └─ → aesc-pre（五巨头 PK → PRD → Abstract Class 脚手架）
│
├─ Abstract Class 已有，需要生成 impl
│   ├─ impl 不存在         → aesc-gen（完整流程）
│   ├─ impl 存在，未 lock  → aesc-gen（覆盖重新生成）
│   └─ impl 存在，已 lock  → ⛔ 跳过（aesc-gen 自动保护）
│
├─ 需要为现有 impl 生成或更新测试
│   └─ → aesc-test（只读 Abstract Class JSDoc，严禁读 impl）
│
├─ impl 有 bug，需要手动修
│   ├─ Step 1: 手动编辑 impl 文件
│   ├─ Step 2: bun test → 确认修复
│   └─ Step 3: lock → 防止下次 aesc-gen 覆盖修复
│
├─ Abstract Class JSDoc 小改（补充说明，行为不变）
│   ├─ scan（更新 .aesc-scan.json）
│   └─ aesc-test（更新测试注释/用例）
│       ⚠️ 不需要 aesc-gen：impl 行为未变
│
├─ Abstract Class 契约大改（新增方法 / 行为变了）
│   ├─ impl 未 lock → aesc-gen（重新生成）
│   └─ impl 已 lock → 二选一：
│       A. unlock → aesc-gen（放弃手改，重新生成）
│       B. 保持 lock，手动在 impl 里实现新方法
│   └─ 之后必须 aesc-test（测试覆盖新契约）
│
├─ 只想查看当前项目的 abstract class 列表
│   └─ → scan only（bun src/scanner.ts --project .）
│
└─ 删除一个 Service
    ├─ Step 1: unlock（如果已 lock）
    ├─ Step 2: 删除 src/service/<name>-service.ts
    ├─ Step 3: 删除 src/generated/<name>.impl.ts
    ├─ Step 4: container-gen（重新生成 DI 容器）
    └─ Step 5: 删除 test/<name>.test.ts → bun test 验证
```

---

## 5 个标准场景

### 🟢 Scenario A：全新 Service，从零开始

```bash
# Phase 1: 需求 → 契约
# → 触发 aesc-pre skill（五巨头拷问→PRD→Abstract Class）
# ⏸ 人类审核：Abstract Class 的 JSDoc 是否足够详细？

# Phase 2: 契约 → 实现
# → 触发 aesc-gen skill
bun src/scanner.ts --project .          # Step 1: 扫描
# （Agent 逐类生成 impl）                # Step 2: AI 生成
bun src/post-processor.ts --project .   # Step 3: 验证修复
bun src/container-gen.ts --project .    # Step 4: 生成 DI 容器
# ⏸ 人类审核：impl 是否符合预期？

# Phase 3: 实现 → 测试
# → 触发 aesc-test skill（只读 JSDoc，严禁读 impl）
bun test                                # Step 4: 运行验证

# （可选）手动微调 impl 后：
bun src/lock-manager.ts lock src/generated/<name>.impl.ts
```

---

### 🟡 Scenario B：JSDoc 小改（补充说明，行为不变）

```bash
# 1. 修改 Abstract Class 的 JSDoc（补充 @edge-cases 等）
# 2. 更新扫描快照
bun src/scanner.ts --project .

# 3. 更新测试（注释引用新 JSDoc，可能新增 edge case 测试）
# → 触发 aesc-test skill

# 4. 验证
bun test

# ✅ 不需要 aesc-gen：impl 行为未变
```

---

### 🔴 Scenario C：契约大改（新方法 / 行为变更）

```bash
# 检查 impl 是否被 lock
bun src/lock-manager.ts list

# 情况 A：未 lock，直接重新生成
# → 触发 aesc-gen skill

# 情况 B：已 lock，需要决策
bun src/lock-manager.ts unlock src/generated/<name>.impl.ts
# → 触发 aesc-gen skill（全新生成，手改内容丢失）

# 无论哪种情况，最后必须：
# → 触发 aesc-test skill（重新覆盖新契约）
bun test
```

---

### 🔧 Scenario D：aesc-test 发现 impl 有 bug

```bash
bun test  # ❌ 某用例失败

# 1. 判断：对照 JSDoc 契约，是测试错了还是 impl 错了？
#    - 测试期望与 JSDoc 一致 → impl 有 bug
#    - 测试期望与 JSDoc 不符 → 修正测试（不动 impl）

# 2. impl 有 bug 时：
#    手动修复 src/generated/<name>.impl.ts
bun test  # ✅ 确认 pass

# 3. 立即 lock，防止下次 aesc-gen 覆盖修复
bun src/lock-manager.ts lock src/generated/<name>.impl.ts
```

> **aesc-test 发现 bug 后，不自动修 impl。告知用户，由人类决定。**

---

### 🗑️ Scenario E：删除一个 Service

```bash
# 1. 解锁（如果 locked）
bun src/lock-manager.ts unlock src/generated/<name>.impl.ts

# 2. 删除文件
rm src/service/<name>-service.ts
rm src/generated/<name>.impl.ts
rm test/<name>.test.ts

# 3. 重新生成 DI 容器（移除已删除的 service）
bun src/container-gen.ts --project .

# 4. 验证没有残留引用
bun test
```

---

## 工具职责边界

| 工具 / Skill | 触发时机 | 输入 | 输出 | 幂等？ |
|-------------|---------|------|------|--------|
| **aesc-pre** | 新功能 / 需求大改 | 用户需求描述 | Abstract Class + PRD | ✅ |
| **scan** | 所有工具的前置步骤 | `src/service/*.ts` | `.aesc-scan.json` | ✅ 只读 |
| **aesc-gen** | 首次生成 / 契约大改 | `.aesc-scan.json` | `*.impl.ts` | ⚠️ 覆盖（lock 除外）|
| **post-process** | aesc-gen 内部步骤 | `*.impl.ts` | 修复后的 `*.impl.ts` | ✅ |
| **container-gen** | aesc-gen 末尾 / impl 增删 | `src/generated/*.impl.ts` | `container.ts` | ✅ |
| **aesc-test** | aesc-gen 后 / JSDoc 变更后 | `.aesc-scan.json` | `test/*.test.ts` | ✅ |
| **lock** | 手动改 impl 后 | `impl 文件路径` | `aesc.lock` 新增 | ✅ 幂等 |
| **unlock** | 决定重新生成时 | `impl 文件路径` | `aesc.lock` 移除 | ✅ 幂等 |

---

## 黄金规则

1. **scan 是入口**：任何工具运行前，`scan` 提供当前项目快照（`.aesc-scan.json`）。
2. **lock 是人类意志的标记**：lock 后，aesc-gen 自动跳过该文件，永不覆盖。
3. **aesc-test 严禁读 impl**：测试来自 JSDoc 契约，不来自实现。读了 impl 的测试没有价值。
4. **手改 impl 后必须立即 lock**：不 lock = 下次 aesc-gen 会覆盖你的修复。
5. **container-gen 必须在 impl 增删后重跑**：否则 DI 容器引用不存在的服务会运行时崩溃。
6. **测试全 pass 才算完成**：不运行 = 不存在。

---

## 反模式

| ❌ 禁止 | ✅ 正确 |
|--------|--------|
| 直接编辑 `generated/` 里的 impl，不 lock | 编辑后立即 `lock` |
| aesc-gen 后不跑 aesc-test | aesc-gen 完成 → 必须配套 aesc-test |
| 读了 impl 再写测试 | 只读 Abstract Class JSDoc 写测试 |
| 修改 JSDoc 后不重新 aesc-test | JSDoc 变了 = 契约变了 = 测试必须更新 |
| 删除 impl 后不重跑 container-gen | 删除/新增 impl 后必须重跑 container-gen |
| unlock 后忘记 aesc-gen | unlock 后应立即 aesc-gen，否则 impl 与契约不符 |

---

## Git + Lock 联防机制

### 为什么 `aesc.lock` 要提交到 git？

`aesc.lock` **不在 `.gitignore` 中**，必须随代码一起提交。

| 如果不提交 aesc.lock | 如果提交 aesc.lock |
|---------------------|------------------|
| A 锁了 impl，B pull 后不知道 | B pull 后自动获得正确的 lock 状态 |
| B 跑 aesc-gen，A 的手改被覆盖 | aesc-gen 自动跳过已 lock 的文件 |
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

### 两条提交路径

```
路径 A：手动修改 impl（需要保护）
  手动改 impl
    → bun src/lock-manager.ts lock <file>   # 先 lock
    → git add <impl> aesc.lock              # 一起提交
    → git commit -m "fix: ..."             # hook 检查通过 ✅

路径 B：aesc-gen 新生成（不需要 lock）
  aesc-gen 完成
    → git add <impl> container.ts          # 只提交 impl
    → git commit --no-verify -m "gen: ..." # 跳过 hook ✅
```

> **规则**：手改 → 必须 lock + 一起提交；新生成 → `--no-verify` 提交。两种情况都不要把 lock 状态和 impl 变更分开提交。

### 典型操作序列（含 git 命令）

```bash
# === 手动修复 impl bug 的完整序列 ===

# 1. 修复 impl
vim demo/src/generated/db.impl.ts

# 2. 运行测试确认
cd demo && bun test && cd ..

# 3. 锁定（防止 aesc-gen 覆盖）
bun src/lock-manager.ts lock demo/src/generated/db.impl.ts

# 4. 一起提交 impl + lock 状态
git add demo/src/generated/db.impl.ts aesc.lock
git commit -m "fix(db): 修复 findObject 未命中时的返回值"
# ✅ pre-commit hook 检查通过（impl 在 lock 里）


# === aesc-gen 新生成的完整序列 ===

# 1. 生成
bun src/scanner.ts --project demo
# ... agent 生成 impl ...
bun src/post-processor.ts --project demo
bun src/container-gen.ts --project demo

# 2. 提交（跳过 hook，因为是新生成的，不是手改的）
git add demo/src/generated/
git commit --no-verify -m "gen: 新增 PaymentService impl"
```
