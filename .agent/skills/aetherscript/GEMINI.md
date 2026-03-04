# AetherScript 舰队版 — Gemini CLI 指南

AetherScript 是一个 **AI 驱动的代码生成框架**。舰队版升级了单 agent 工作流，引入五大专家角色协作，通过多轮 PK 产出高质量的代码架构和实现。

---

## 🚀 快速开始

```bash
# 第一步：需求收集（五巨头拷问 → PRD → Abstract Class）
/aesc-pre 我想构建一个用户认证系统

# 第二步：代码生成（三团队并行 → 三巨头审判）
/aesc-gen

# 第三步：测试生成（三测试团队 → 五巨头放行）
/aesc-test
```

---

## 五大专家角色

| 角色 | 代号 | 职责 |
|------|------|------|
| 🤪 超级狂野PM | `pm` | 挖需求、用户故事、商业价值 |
| 👑 架构暴君 | `arch` | 技术可行性、系统设计 |
| 🔍 QA黑客 | `qa` | 边界条件、异常场景 |
| 🔒 安全死心眼 | `sec` | 安全漏洞、权限边界 |
| 💰 预算狂魔 | `budget` | 成本、复杂度、MVP边界 |

**三巨头** = arch + qa + sec（负责技术审判）  
**五巨头** = 全员（负责最终放行投票）

---

## 命令详情

### `/aesc-pre [需求描述]`

**舰队需求收集 → PRD → Abstract Class 脚手架**

**三阶段流程：**
1. **五巨头轮番拷问** — 每人3-5个刁钻问题，用户逐一回答
2. **五巨头10轮PK** — 互相点评投票，产出 `docs/PRD.md`
3. **三巨头架构PK** — 10轮架构讨论，产出含 `// @autogen` 的 Abstract Class

**产出：**
- `docs/PRD.md` — 需求文档
- `src/entity/[name].ts` — 数据实体
- `src/service/[name]-service.ts` — 抽象类（含极详细 JSDoc）

---

### `/aesc-gen`

**三开发团队并行实现 → 三巨头审判 → 最佳实现**

**三大团队：**
- 🛡️ **稳健派**（Team Solid）— 防御性编程，极致可靠
- ⚡ **激进性能派**（Team Turbo）— 并发优化，高性能
- 🎨 **优雅代码派**（Team Elegant）— 函数式，可读性第一

**产出：**
- `src/generated/[service].impl.ts` — 最佳实现
- `src/generated/container.ts` — 依赖注入容器

---

### `/aesc-test`

**三测试团队全面攻击 → 五巨头投票放行**

**三测试团队：**
- 🔍 **QA黑客团队** — 功能正确性、边界值
- 🔒 **安全死心眼团队** — 注入攻击、权限绕过
- 👑 **架构暴君团队** — 并发、契约验证

**放行条件：** ≥ 4/5 巨头投票支持

**产出：**
- `test/[service].test.ts` — 综合测试套件

---

## `// @autogen` 标记说明

AetherScript 通过 `// @autogen` 注释标记需要 AI 实现的 Abstract Class。

```typescript
// @autogen
/**
 * UserService — 用户账户管理服务
 * 由三巨头审定 (arch + qa + sec)
 */
export abstract class UserService {
    // @AutoGen — 数据库依赖，自动注入
    public db?: Database;

    /**
     * 用户登录
     * 
     * @description
     * 实现步骤：
     * 1. 验证 username 非空，长度 3-50
     * 2. 查询用户记录，不存在则抛出 UserNotFoundError
     * 3. 使用 bcrypt 验证密码
     * 4. 生成 JWT token，有效期 24h
     * 5. 记录登录日志（IP + 时间戳）
     * 
     * @security 密码不能明文存储，使用 bcrypt
     * @edge-cases 连续5次失败需锁定账户
     */
    public abstract login(username: string, password: string): Promise<AuthToken>;
}
```

---

## 项目结构约定

```
your-project/
├── src/
│   ├── entity/          ← 实体定义（aesc-pre 生成）
│   ├── service/         ← Abstract Class（aesc-pre 生成，含 @autogen）
│   └── generated/       ← AI 实现（aesc-gen 生成，不要手动编辑！）
│       ├── container.ts
│       └── *.impl.ts
├── test/                ← 测试套件（aesc-test 生成）
│   └── *.test.ts
└── docs/
    ├── PRD.md           ← 需求文档（aesc-pre 生成）
    └── FLEET_ARCHITECTURE.md
```

---

## 代码审查原则

在代码审查时，只需关注：

✅ **需要审查：**
- `src/entity/*.ts` — 数据模型正确性
- `src/service/*-service.ts` — 接口设计和 JSDoc 描述
- `docs/PRD.md` — 需求是否准确

❌ **不需要审查（AI 负责）：**
- `src/generated/*.impl.ts` — 实现细节
- `src/generated/container.ts` — DI 容器
- `test/*.test.ts` — 测试用例

---

## 更多资源

- 查看 `docs/FLEET_ARCHITECTURE.md` 了解五大角色完整人格和 PK 规则
- 查看 `demo/` 和 `demo_simple/` 了解实际使用示例
