# AetherScript 🚀 舰队版

> **"Define interfaces, not implementations."**  
> 五大专家角色协作，从需求到代码，全程 AI 舰队护航。

AetherScript 是一个 **AI 驱动的代码生成框架**，作为 Gemini CLI（或其他 AI 编码工具）的扩展运行。舰队版引入了五大专家角色多轮协作机制，将单 agent 的代码生成升级为专业团队的协同作战。

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

## ⚡ 工作流

### Step 0: `/aesc-pre` — 五巨头协作需求收集

```bash
/aesc-pre 我想构建一个用户认证系统
```

**三阶段流程：**

```
阶段1：五巨头轮番拷问（每人3-5个刁钻问题）
       ↓ 用户回答
阶段2：五巨头10轮PK（互相点评 + 投票收敛）
       ↓ 产出 docs/PRD.md
阶段3：三巨头架构PK（10轮 → Abstract Class 设计）
       ↓ 产出 src/entity/ 和 src/service/（含 @autogen）
```

### Step 1: `/aesc-gen` — 三团队并行实现

```bash
/aesc-gen
```

**三大开发团队同时上阵：**

| 团队 | 风格 | 擅长 |
|------|------|------|
| 🛡️ 稳健派 | 防御性编程 | 可靠性第一，严格校验 |
| ⚡ 激进性能派 | 并发优化 | 性能极致，Promise.all |
| 🎨 优雅代码派 | 函数式 | 可读性，链式调用 |

三巨头审判后，选出最佳实现 → `src/generated/`

### Step 2: `/aesc-test` — 三测试团队全面攻击

```bash
/aesc-test
```

**三测试团队分工：**
- 🔍 QA黑客 → 功能正确性、边界值测试
- 🔒 安全死心眼 → 注入攻击、权限绕过测试
- 👑 架构暴君 → 并发、契约验证测试

**放行条件：** 五巨头 ≥ 4/5 票支持 → `test/`

---

## 📁 项目结构

```
your-project/
├── src/
│   ├── entity/          ← 实体定义（Step 0 生成）
│   ├── service/         ← Abstract Class（Step 0 生成）
│   │   └── *-service.ts   （含 // @autogen + 极详细 JSDoc）
│   └── generated/       ← AI 实现（Step 1 生成，禁止手动编辑）
│       ├── container.ts
│       └── *.impl.ts
├── test/                ← 测试套件（Step 2 生成）
├── docs/
│   ├── PRD.md           ← 需求文档（Step 0 生成）
│   └── FLEET_ARCHITECTURE.md ← 舰队架构说明
└── .agent/skills/aetherscript/
    └── commands/
        ├── aesc-pre.toml
        ├── aesc-gen.toml
        └── aesc-test.toml
```

---

## 🔖 @autogen 标记说明

只需在 Abstract Class 上加 `// @autogen`，AetherScript 舰队会自动扫描并生成实现：

```typescript
// @autogen
export abstract class OrderService {
    // @AutoGen — 数据库依赖（自动注入）
    public db?: Database;

    /**
     * 创建订单
     * 
     * @description
     * 实现步骤：
     * 1. 验证 customerId 存在
     * 2. 检查所有商品库存
     * 3. 计算总价（含优惠）
     * 4. 开启事务，写入订单 + 扣库存
     * 5. 发送确认通知
     * 
     * @security 必须验证用户有权下单（JWT + 权限检查）
     * @edge-cases 库存并发扣减需乐观锁
     * @performance 商品查询批量处理，避免 N+1
     */
    public abstract createOrder(
        customerId: string,
        items: OrderItem[]
    ): Promise<Order>;
}
```

---

## 🧠 为什么舰队版更好？

| 对比项 | 单 Agent | 舰队版 |
|--------|---------|--------|
| 需求挖掘 | 通用问题 | 五角色多维度刁钻问题 |
| 设计决策 | 单视角 | 多轮 PK 后的收敛决策 |
| 代码实现 | 一份方案 | 三份方案 + 三巨头审判 |
| 测试覆盖 | 基础测试 | 质量 + 安全 + 性能三维度 |
| 放行机制 | 无 | 五巨头 4/5 票投票 |

---

## 📚 安装与使用

### 前提条件
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) 已安装
- [Bun](https://bun.sh) 已安装（用于运行生成脚本）

### 安装 AetherScript 扩展

将 `.agent/skills/aetherscript/` 目录复制到你的项目，或配置 Gemini CLI 的扩展路径。

### 第一次使用

```bash
# 在你的项目目录中
gemini
/aesc-pre 描述你想要构建的功能
```

---

## 📖 示例项目

- `demo/` — 电商系统完整示例（用户、订单、商品、缓存等服务）
- `demo_simple/` — 简单用户服务示例

---

## 🏛️ 架构文档

详细的角色人格、PK 规则、放行条件，请查阅：

👉 **[docs/FLEET_ARCHITECTURE.md](docs/FLEET_ARCHITECTURE.md)**

---

## 许可证

MIT
