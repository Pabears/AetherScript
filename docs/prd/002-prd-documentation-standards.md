# PRD 002: AESC PRD 文档规范

## 概述

为所有使用 AetherScript (AESC) 的项目建立统一的 PRD 文档管理规范，
包括路径约定、命名格式、Append-Only 原则与年度归档机制。

PRD 的核心目的是**重建决策树**——未来的 AI Agent 或人类开发者读 PRD，
能够理解「为什么这样设计」，而不仅仅是「设计了什么」。

---

## 五巨头 PK 决策记录（2026-07-15）

### 争议1：Append-Only 的粒度

- **PM 观点**：应允许修改，但修改必须留下明确痕迹（`prd-amend:` commit prefix）
- **QA 观点**：物理上用 git hook 强制，比君子协定可靠
- **最终裁决**：Git hook 检测 diff 中的 `-` 行；有 `-` 行但 commit message 以 `prd-amend:` 开头则放行

### 争议2：年度归档 vs 永久保留

- **arch 观点**：随着项目增长，活跃 PRD 数量会影响 AI 上下文效率，需要归档
- **budget 观点**：归档成本低，但需要 hook 白名单避免触发 append-only
- **最终裁决**：每年执行一次 compaction；`prd-compaction:` commit prefix 跳过检测

### 争议3：高风险字段二次确认

- **sec 观点**：密码学参数写进 PRD 可能被 aesc-gen 盲目实现
- **最终裁决**：不在工具层实现，由 CR 流程（人工或 AI）负责。工具复杂度优先级低。

---

## 功能边界

### 必须实现 (MVP)

- PRD 路径规范：所有项目统一使用 `docs/prd/NNN-kebab-case-name.md`
- 编号规则：三位递增整数，从 `001` 起，每个 PRD 一个独立文件
- Append-Only git hook：commit 时检测 PRD 文件是否有行被删除
- 修改白名单：commit message 以 `prd-amend:` 开头时允许修改
- 编号冲突检测：push 前检测 `docs/prd/` 中是否有重复 NNN 编号
- 年度归档路径：`docs/prd/archive/YYYY/`
- Compaction 白名单：commit message 以 `prd-compaction:` 开头时跳过所有 PRD 检测

### 不在范围内

- 高风险字段自动检测
- PRD 内容格式的结构化校验（JSON schema 等）
- PRD 与 abstract class 的自动关联（未来可加 `@prd` 注释）

---

## 路径与命名规范

```
docs/
└── prd/
    ├── 001-aesccfg-module-config.md    ← 最老的决策
    ├── 002-prd-documentation-standards.md
    ├── 003-next-feature.md
    └── archive/
        └── 2025/
            └── 001-legacy-feature.md   ← 年度归档后移入
```

### 命名规则

| 元素 | 规则 | 示例 |
|---|---|---|
| 编号 | 3位十进制，不足补零 | `001`, `042`, `100` |
| 分隔符 | 单个 `-` | `001-` |
| 名称 | kebab-case 英文，描述 feature | `aesccfg-module-config` |
| 扩展名 | `.md` | |

**完整示例：** `003-frontend-plugin-registry.md`

---

## Append-Only 原则

### 定义

**物理 Append-Only**：PRD 文件中的任何已有行不得被删除。  
**逻辑可推翻**：新决策可以写在新段落或新 PRD 文件中推翻旧决策，但旧内容保留。

### 允许的操作

| 操作 | 是否允许 | 方式 |
|---|---|---|
| 追加新内容到文件末尾 | ✅ | 正常 commit |
| 修改/删除已有行 | ⚠️ 需声明 | `prd-amend:` commit prefix |
| 新建一个更高编号的 PRD | ✅ | 正常 commit |
| 年度归档（移动旧文件） | ✅ | `prd-compaction:` commit prefix |

### 错误修正示例

```markdown
<!-- AMENDMENT 2026-08-01: outputPath 默认值应为 "src/generated/"，原文写成了 "generated/" -->
```

追加这段注释，然后用 `prd-amend: fix outputPath default value typo` commit。

---

## 编号冲突防护

git hook（`pre-push`）在每次 push 前扫描 `docs/prd/` 目录：

1. 提取所有文件名的 NNN 前缀
2. 检查是否有重复
3. 与 `origin/main` 上已有的编号对比，检测并行分支冲突
4. 有冲突则阻断 push，提示需要 rebase 并重新编号

---

## 年度归档（Compaction）

每年 1 月执行一次（非强制，但推荐）：

```bash
YEAR=2025
mkdir -p docs/prd/archive/$YEAR
mv docs/prd/0*.md docs/prd/archive/$YEAR/
git add .
git commit -m "prd-compaction: archive $YEAR PRDs to docs/prd/archive/$YEAR/"
```

归档后，下一个 PRD 编号从 1 继续（不重置），确保全局唯一性。

---

## 业务规则

1. 每个 AESC 项目在初始化时必须创建 `docs/prd/` 目录
2. `aesc-pre` skill 产出的 PRD 自动写入 `docs/prd/NNN-name.md`，编号由用户指定或自动计算（当前最大值 + 1）
3. PRD 文件一经 commit 即进入 Append-Only 状态
4. 没有 PRD 不阻止 `aesc-gen` 运行，但 AGENTS.md 应明确要求"生成前先写 PRD"

---

## 边界条件

- **首个 PRD 是规范本身**：`002-prd-documentation-standards.md` 是 AESC 的第二个 PRD，`001` 是它的前身 `aesccfg-module-config`
- **编号跳跃**：允许（`001`, `003` 中间没有 `002`），只要无重复
- **archive 目录中的文件**：不参与冲突检测，不受 Append-Only hook 约束

---

## 安全要求

- `prd-amend:` 和 `prd-compaction:` 前缀仅作为 hook 白名单，不赋予其他特权
- hook 实现中不执行任何用户提供的数据作为 shell 命令

---

## 非功能需求

- **工具侵入性最小**：hook 只新增检测逻辑，不影响现有 commit 流程
- **跨项目统一**：同一套 hook 脚本可以复制到任何 AESC 项目
- **可逃生**：`git commit --no-verify` 跳过所有 hook（仅限紧急情况，需 CR 补偿）
