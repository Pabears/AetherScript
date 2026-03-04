---
name: aetherscript
description: >
  AetherScript 舰队——AI-assisted TypeScript 全流程代码生成。用多个 sub-agent 角色组成战队，
  通过 aesc-pre（需求+架构）、aesc-gen（并行实现+审判）、aesc-test（三维测试+放行）三个阶段，
  端到端生成高质量 TypeScript 项目。触发词：aesc-pre、aesc-gen、aesc-test、aetherscript舰队、
  implement abstract class、autogen、AetherScript。
---

# AetherScript 舰队

用 sub-agent 角色战队驱动 TypeScript 全流程生成。每个阶段都是真实的多 agent 协作，有 PK、有审判、有放行。

## 五大核心角色

| 角色 | 代号 | 职责 |
|------|------|------|
| 🤪 超级狂野PM | `pm` | 疯狂挖需求、脑洞开盖、逼出用户真实意图 |
| 👑 架构暴君 | `arch` | 质问技术可行性、设计系统结构、性能审判 |
| 🔍 QA黑客 | `qa` | 边界条件、异常场景、功能测试 |
| 🔒 安全死心眼 | `sec` | 死磕安全漏洞、注入攻击、权限边界 |
| 💰 预算狂魔 | `budget` | 成本、复杂度、ROI、技术债 |

**三巨头** = arch + qa + sec（贯穿全流程的终极审判团）
**五巨头** = 全部五个角色

---

## aesc-pre：需求与架构舰队

### 阶段一：PRD 拷问（五巨头轮流上阵）

用 `sessions_spawn` 为每个角色启动独立 sub-agent，传入用户原始需求。

每个角色的 task prompt 模板：
```
你是 [角色名]。用户的原始需求是：[需求原文]。
其他角色已提出以下问题和观点：[前序角色输出]。
现在轮到你：用你的角色视角，向用户提出 3-5 个最刁钻的问题，
并对前序角色的观点进行点评（可以开喷）。
最后给出你认为这个需求最大的风险点。
```

五个角色依次跑完（顺序：pm → arch → qa → sec → budget），收集所有输出后进行 **10轮 PK**：
- 每轮：将所有角色观点汇总，让三巨头各自投票"最大风险"并给出理由
- 10轮后，综合输出 **PRD 文件**（写入 `docs/PRD.md`）

### 阶段二：Technical Design（三巨头 PK）

基于 PRD，启动 arch + qa + sec 三个 sub-agent，**并行**产出 Technical Design：
- 每人独立提出模块边界、接口定义、依赖关系方案
- **5轮 PK**：互相质疑对方的设计，直到收敛
- 输出：`docs/TECHNICAL-DESIGN.md`（只含接口定义和依赖关系，不含 abstract class 代码）

Technical Design 必须包含：
- 所有模块及其职责（每个模块职责单一，方法数 ≤ 3）
- 模块间依赖关系图
- 关键接口签名（TypeScript 类型，不是实现）
- 不可 autogen 的安全组件清单

### 阶段三：Abstract Class 生成（含复杂度门禁）

基于 Technical Design，生成 Abstract Class 文件：
- 每个类单独生成，含 `// @autogen` 标记、完整 JSDoc、方法签名
- **复杂度门禁**（硬性规则，不通过不继续）：
  - 方法数 > 3 → 必须拆分
  - 参数总数（全部方法合计）> 8 → 必须拆分
  - 预估实现行数 > 150 → 必须拆分
- 输出：`src/abstracts/[name].ts`

---

## aesc-gen：实现舰队

### 阶段一：两组并行实现

用 `sessions_spawn` 启动两个开发团队 sub-agent，**同时**执行（parallel）：

| 团队 | 风格 | 模型 | task prompt 重点 |
|------|------|------|-----------------|
| 🏗️ 开发一组 | 稳健派 | Sonnet | 防御优先、完整错误处理、边界检查、可维护性 |
| 🎨 开发二组 | 优雅派 | Opus | 设计模式、可读性、可扩展性、最小复杂度 |

**关键约束（每组 prompt 必须包含）：**
```
你是 [团队名]。基于以下 Abstract Class，生成完整的 TypeScript 实现。
⚠️ 必须严格遵守：
1. class 声明骨架由框架提供，不允许修改：
   class [Name]Impl extends Abstract[Name] { ... }
2. 所有方法签名必须与 Abstract Class 完全一致
3. 不允许引入抽象类签名以外的新公共方法
[abstract class 内容]
风格要求：[团队风格]
输出：完整的 .impl.ts 文件内容（≤150行）
```

### 阶段二：三巨头审判

将两组实现交给 arch + qa + sec（**每类一个 sub-agent，并行**），每人评分（0-100）并给出理由，选出最佳实现或指定融合点。
用 `aesc_write` 将获胜/融合实现写入 `src/generated/`。

---

## aesc-test：测试舰队

### TDD 原则（v3.0 强制要求）

⚠️ **测试必须先于实现生成，且禁止看到实现代码。**
测试 sub-agent 的 input 只能包含：抽象类签名 + JSDoc。
禁止传入 `.impl.ts` 内容，否则 AI 会把 bug 当 feature 测。

### 测试生成（每类一个 sub-agent，并行）

每个类单独启动一个测试 sub-agent（模型：Sonnet 够用，不需要 Opus）：
```
你是 QA黑客。只看以下抽象类签名和 JSDoc，生成黑盒测试。
禁止猜测实现细节。只测接口契约。
[abstract class 内容，不含 impl]
输出：bun:test 格式，≤150行
```

### 强制运行（硬性门禁）

测试文件生成后，**必须执行**：
```bash
bun test --bail
```
- 通过 → ✅ 继续
- 失败 → 🚫 阻断，报告失败用例，重新生成或修复 impl

不运行 = 不存在。这是质量闭环唯一的外部锚点。

用 `aesc_test_write` 写入 `test/`。

---

## 执行要点

### sub-agent 调用方式

```
sessions_spawn(
  task="[角色prompt]",
  label="aesc-[阶段]-[角色代号]",
  model="sonnet",        // 普通角色用 sonnet
  // 三巨头审判用 claude（更强）
)
```

### 并行 vs 串行

- **并行**：同一阶段内多个角色/团队同时 spawn（如三组开发团队）
- **串行**：阶段之间必须串行（pre → gen → test）

### 结果汇总

每个 sub-agent 完成后用 `sessions_history` 拉取输出，汇总后交给下一阶段。

### 工具映射

| 工具 | 用途 |
|------|------|
| `sessions_spawn` | 启动各角色 sub-agent |
| `sessions_history` | 拉取 sub-agent 输出 |
| `aesc_scan` | 扫描 @autogen 类 |
| `aesc_write` | 写入实现文件 |
| `aesc_test_write` | 写入测试文件 |

---

详细角色 prompt 模板见 [roles.md](references/roles.md)
PK 轮次裁判逻辑见 [pk-rules.md](references/pk-rules.md)
