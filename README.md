# AetherScript 🚀

> **"Define interfaces, not implementations."**  
> 五大专家角色协作，从需求到代码，全程 AI 舰队护航。

AetherScript 是一个 **AI 驱动的 TypeScript 代码生成框架**。舰队版引入了五大专家角色多轮协作机制，将单 agent 的代码生成升级为专业团队的协同作战，通过 OpenClaw 的 `sessions_spawn` 驱动多 agent 并行运行。

---

## 🎯 核心理念

传统 AI 代码生成的问题：一个 agent 既当 PM 又当架构师又当安全专家，视角单一，容易遗漏关键设计决策。

AetherScript 舰队版的解法：**五个性格迥异的专家角色**，从各自视角拷问需求、互相 PK，通过结构化的投票机制收敛到高质量的设计决策。

---

## 👥 五大核心角色

| 角色 | 代号 | 性格 | 职责 |
|------|------|------|------|
| 🤪 超级狂野PM | `pm` | 脑洞无限，挖需求像剥洋葱 | 用户需求、商业价值、功能边界扩展 |
| 👑 架构暴君 | `arch` | 傲慢精准，对模糊零容忍 | 系统设计、技术可行性、扩展性 |
| 🔍 QA黑客 | `qa` | 偏执，专门想怎么搞崩系统 | 边界条件、异常场景、幂等性 |
| 🔒 安全死心眼 | `sec` | 多疑，把一切看作攻击向量 | 安全漏洞、权限控制、数据加密 |
| 💰 预算狂魔 | `budget` | 务实守财奴，质疑过度设计 | 成本估算、MVP边界、复杂度控制 |

**三巨头** = arch + qa + sec（技术决策核心）  
**五巨头** = 全员（最终放行投票）

---

## ⚡ 三阶段工作流

### aesc-pre — 五巨头协作需求与架构设计

```
阶段1：五巨头轮番拷问（每人3-5个刁钻问题）
       ↓ 用户回答
阶段2：五巨头10轮PK → 产出 docs/PRD.md
阶段3：三巨头架构PK → 产出 Abstract Class 设计
       (每人独立设计 → 互相评审 → 逐文件修订)
```

### aesc-gen — 三团队并行实现 + 三巨头裁决

```
三支开发团队并行实现：
  🛡️ 稳健派   — 可靠性第一，严格校验，完整错误处理
  ⚡ 性能派   — 极致性能，并发优化，缓存
  🎨 优雅派   — 设计模式，纯函数，可扩展性

三巨头裁决（每个类单独一个 sub-agent，output 严格限字数）：
  → 选出最佳方案基底 + 融合建议 → docs/VERDICT.md
  → 生成最终实现 → v2/src/final/
```

### aesc-test — 三测试团队全面攻击

```
🔍 QA黑客     → 功能正确性、边界值测试
🔒 安全死心眼  → 注入攻击、权限绕过测试
👑 架构暴君   → 并发、契约验证、性能测试

放行条件：五巨头 ≥ 4/5 票 → test/
```

---

## 📁 项目结构

```
AetherScript/
├── v2/
│   └── src/
│       ├── abstracts/    ← 8个抽象类（核心契约，手写，禁止 autogen）
│       └── final/        ← 最终融合实现（三巨头裁决后生成）
├── fleet/                ← 舰队任务状态管理
├── docs/
│   ├── PRD-2.0.md            ← 五巨头产出的需求文档
│   ├── TECHNICAL-DESIGN.md   ← 接口定义（方法签名+类型）
│   ├── VERDICT.md            ← 三巨头裁决结果
│   └── FLEET_ARCHITECTURE.md ← 舰队架构 + 实战经验
└── AGENT.md
```

---

## 🔖 @autogen 标记

只有标记了 `// @autogen` 的 Abstract Class 会被舰队生成实现。安全相关类（PromptSanitizer、Validator 等）**永远不标记**，手动实现。

```typescript
// @autogen
export abstract class CodeGenerator {
  /**
   * 根据扫描结果生成 TypeScript 实现代码
   * @param payload 已经过 PromptSanitizer 消毒的安全载荷
   */
  abstract generateImplementation(payload: SanitizedPayload): Promise<UntrustedGenerationResult>;
  abstract buildPrompt(payload: SanitizedPayload): string;
}
```

---

## 🧠 关键设计决策

- **只有 `AbstractCodeGenerator` 可以 autogen**，其余7个类手写，保证安全边界
- **品牌类型链**：`ScanResult → SanitizedPayload → UntrustedGenerationResult → ValidatedResult`，不可跳过阶段
- **三巨头裁决用"每类一个 sub-agent"模式**，充分利用 input/output 长度不对称（input 大方投，output 切细切小）
- 详见 [docs/FLEET_ARCHITECTURE.md](docs/FLEET_ARCHITECTURE.md) 中的实战经验记录

---

## 🏛️ 架构文档

详细的角色人格、PK 规则、实战经验与改进记录：

👉 **[docs/FLEET_ARCHITECTURE.md](docs/FLEET_ARCHITECTURE.md)**

---

## 许可证

MIT
