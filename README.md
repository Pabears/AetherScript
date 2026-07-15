# AetherScript (aesc)

> **AI-Assisted Development You Can Trust.**
>
> 把人类意图（Abstract Class 契约）和 AI 实现（生成的 impl）彻底分离，用确定性工具链取代幻觉。

📖 **开发工作流**：[什么时候用 scan / ad / build / lock？](docs/workflow.md)

---

## 核心思想

单个 LLM 调用是概率云——可能幻觉、可能截断、可能做出意想不到的选择。aesc 的解法是：

**“巨型批处理 (Mega-Batch Prompting)” + “影子宇宙盲写 (Shadow Workspaces & Blind Generation)” + “外层闭环自愈 (Outer Validation Loop)”。**

| 确定性工具（TS 脚本）| AI（Agent）|
|---|---|
| 扫描 AST、提取契约 | **aesc-pre**: 五巨头视角挖掘需求生成 PRD |
| **aesc-build**: 影子宇宙并发拉起管线 | **aesc-ad**: PRD 到 Abstract Class 的桥梁推演 |
| AST刚性验证、修复语法错误 | **Mega-Batch**: 并发盲写业务逻辑 (Impl) 与测试用例 |
| 黑盒业务测试执行闭环 | **Blind Judge (盲审法官)**: 契约冲突时的溯源与纠错 |
| 锁定手动改过的文件 | — |

人类负责协议与边界，AI 负责智能填空，脚本负责刚性验收。

---

## 工具链

```
AetherScript/
  src/
    scanner.ts        # 扫描 // @autogen / // @AutoGen → <目标项目>/.aesc-scan.json
    aesc-build.ts     # 启动并行流水线 (Shadow Workspaces + Blind Judge)
    post-processor.ts # 验证 + 修复生成的 impl（implements→extends、重复 property 删除）
    container-gen.ts  # 生成类型安全的 DI container.ts
    lock-manager.ts   # 保护手动修改的 impl 不被覆盖
```

> ⚠️ **所有工具命令均在 AetherScript 根目录下执行**，通过 `--project` 指向目标项目。

```bash
# 在 AetherScript 根目录运行，--project 指向你的目标项目
AESC_ROOT=/path/to/AetherScript
MY_PROJECT=/path/to/my-project

bun $AESC_ROOT/src/scanner.ts --project $MY_PROJECT
bun $AESC_ROOT/src/aesc-build.ts --project $MY_PROJECT
bun $AESC_ROOT/src/lock-manager.ts lock|unlock|list|check <文件>

# aesc 自身的测试（在 AetherScript 根目录）
bun test           # 工具链回归测试
bun run test:demo  # 电商 demo 黑盒测试
bun run test:all   # 全跑
```

---

## 在外部项目中使用

### Step 1：克隆 AetherScript（一次性）

```bash
# 建议放在一个固定位置，供多个项目共享
git clone https://github.com/Pabears/AetherScript.git ~/tools/aesc
cd ~/tools/aesc && bun install
```

### Step 2：安装 git hooks（每个项目一次）

```bash
# 在你的目标项目根目录
bash ~/tools/aesc/scripts/setup-hooks.sh
```

> 这会配置 `core.hooksPath`，让 git 使用 aesc 的 pre-commit / post-merge / post-checkout hooks 保护 lock 状态。

### Step 3：目标项目最低要求

目标项目只需要：
- `tsconfig.json`（告知 ts-morph 如何解析 TS 文件）
- `src/service/` 目录（放 abstract class）
- `src/generated/` 目录（工具链输出 impl 和 container）

```bash
mkdir -p src/service src/generated
```

> 目标项目**不需要**安装 aesc 作为依赖。标注语法是纯注释（`// @autogen`、`// @AutoGen`），零运行时依赖。

### Step 4：构建与闭环

```bash
AESC=~/tools/aesc
MY_PROJECT=$(pwd)   # 你的目标项目根目录

# 扫描提取契约
bun $AESC/src/scanner.ts --project $MY_PROJECT

# 执行全自动并行盲写与验收流水线
bun $AESC/src/aesc-build.ts --project $MY_PROJECT
```

### 输出文件位置

| 文件 | 位置 | 说明 |
|------|------|------|
| `.aesc-scan.json` | `<目标项目根目录>/` | 扫描快照，自动被 `.gitignore` 排除 |
| `*.impl.ts` | `<目标项目>/src/generated/` | AI 生成的实现，提交到 git |
| `container.ts` | `<目标项目>/src/generated/` | DI 容器，提交到 git |
| `aesc.lock` | `<目标项目根目录>/` | lock 状态，**必须提交到 git** |

---

## 完整工作流 (End-to-End Workflow)

### Phase 1：aesc-pre（需求挖掘 → PRD）

触发 `/aesc-pre` skill。五巨头扮演不同视角（PM、架构、QA、安全、预算），通过多轮 PK 深度挖掘需求边界，产出：
- `docs/prd/XXX-feature.md` — Append-only 需求文档。

### Phase 1.5：aesc-ad（架构桥梁：PRD → Abstract Class）

触发 `/aesc-ad` skill。AI 首席架构师登场，读取 PRD，通过 CoT 思维链推演出高内聚低耦合的架构，将非结构化的需求精准转化为：
- `src/entity/*.ts` — 数据实体
- `src/service/*-service.ts` — **Abstract Class 脚手架**（带完整 JSDoc 契约）

**人类最终门控 (Human Review Gate)**：
在进入下一步前，人类必须 `tsc --noEmit` 检查生成的契约，确认符合系统设计理念。

#### 标注语法

```typescript
// @autogen             ← 标记整个 abstract class 需要参与流水线
export abstract class UserService {
    // @AutoGen          ← 标记该属性需要 DI 容器自动注入
    public db?: DB;

    /**
     * @description
     * 1. 验证 name 长度 [3, 15]
     * 2. 调用 this.db!.save(user)
     * @throws Error 如果 name 长度不在 [3, 15]
     * @edge-cases name 为特殊字符时...
     */
    public abstract create(user: User): void;
}
```

---

### Phase 2：aesc-build（Mega-Batch 盲写与盲审闭环）

执行 `bun src/aesc-build.ts` 自动化管道。
这是彻底剥离人工操作的“机械化引擎”：

1. **Shadow Workspaces (影子宇宙)**：克隆目标项目，分别在 `.aesc/shadow-gen/` 和 `.aesc/shadow-test/` 独立启动环境。
2. **Blind Generation (盲写)**：Mega-Batch 高级大模型并发产出 `impl` 和 `test`。两个 Agent 互不可见，只能基于 Abstract Class 进行黑盒博弈。
3. **AST 刚性验证**：外层脚本调用 `post-processor.ts` 和 `container-gen.ts`，确保没有漏写方法或破坏契约。
4. **Merge & Clash (合并碰撞)**：将生成的代码拉回主干宇宙，执行 `bun test`。
5. **Blind Arbitration (盲审法官)**：如果测试失败，唤醒 Judge Agent。法官根据 JSDoc 契约、`impl` 和报错日志，客观判定是谁违背了契约并打回重造（Max Retries = 3）。

---

## 关键设计决策

### 为什么采用影子宇宙 (Shadow Workspaces) 和盲写？

如果让同一个 Agent 同时写实现和测试，它会产生“护短”的幻觉——写了一个有 bug 的实现，然后顺手写了一个刚好能让这个 bug 跑通的测试。
**盲写 (Blind Generation)** 保证了实现和测试是完全正交的，两者唯一的交汇点就是 Abstract Class 契约。一旦碰撞失败，问题立刻暴露。

### lock 机制

```bash
bun src/lock-manager.ts lock src/generated/db.impl.ts   # 手动改过的文件，保护不被覆盖
bun src/lock-manager.ts list                            # 查看当前锁定列表
bun src/lock-manager.ts unlock src/generated/db.impl.ts # 解锁，允许重新生成
```

对于那些确实需要人类介入的边界情况，手动修改后锁定，流水线将自动跳过。

---

## 项目结构

```
AetherScript/
  src/                    # aesc 工具链（确定性 TS 脚本）
    scanner.ts
    aesc-build.ts         # Mega-Batch 流水线主控
    post-processor.ts
    container-gen.ts
    lock-manager.ts
  test/                   # 工具链自身的回归测试
  demo/                   # 电商示例项目
  .agents/skills/         # Antigravity Skills
    aesc-pre/             # 需求收集
    aesc-ad/              # 架构推演
    aesc-build/           # 并发流水线与盲审
```
