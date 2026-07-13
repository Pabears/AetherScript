# AetherScript (aesc)

> **AI-Assisted Development You Can Trust.**
>
> 把人类意图（Abstract Class 契约）和 AI 实现（生成的 impl）彻底分离，用确定性工具链取代幻觉。

---

## 核心思想

单个 LLM 调用是概率云——可能幻觉、可能截断、可能做出意想不到的选择。aesc 的解法是：

**把 AI 能做好的事和 AI 做不好的事拆开。**

| 确定性工具（TS 脚本）| AI（Agent）|
|---|---|
| 扫描 AST、提取契约 | 读懂 JSDoc，生成实现 |
| 验证编译、修复语法错误 | 理解业务逻辑，填充方法体 |
| 生成 DI 容器 | 推导测试用例 |
| 锁定手动改过的文件 | — |

AI 负责智能，脚本负责确定性。两者各司其职，幻觉被限制在有限的输出范围内。

---

## 工具链

```
src/
  scanner.ts        # 扫描 // @autogen / // @AutoGen → .aesc-scan.json
  post-processor.ts # 验证 + 修复生成的 impl（implements→extends、重复 property 删除）
  container-gen.ts  # 生成类型安全的 DI container.ts
  lock-manager.ts   # 保护手动修改的 impl 不被覆盖
```

```bash
# 常用命令
bun src/scanner.ts [--project <目标项目路径>]
bun src/post-processor.ts [--project <路径>]
bun src/container-gen.ts [--project <路径>]
bun src/lock-manager.ts lock|unlock|list|check <文件>

# 测试
bun test           # aesc 工具自身的回归测试（31 cases）
bun run test:demo  # demo 电商示例的黑盒业务测试（96 cases）
bun run test:all   # 全跑
```

---

## 完整流程

### Phase 1：aesc-pre（需求 → Abstract Class）

触发 `/aesc-pre` skill。五巨头扮演不同视角（PM、架构、QA、安全、预算），通过多轮 PK 收敛出 PRD，最终产出：

- `docs/PRD.md` — 需求文档
- `src/entity/*.ts` — 数据实体
- `src/service/*-service.ts` — **Abstract Class 脚手架**（带完整 JSDoc 契约）

**Abstract Class 是整个系统的唯一真相来源。** JSDoc 中的每个步骤、`@throws`、`@edge-cases` 都将直接驱动后续的代码生成和测试。

#### 标注语法

```typescript
// @autogen             ← 标记整个 abstract class 需要生成 impl
export abstract class UserService {
    // @AutoGen          ← 标记该属性需要 DI 容器自动注入
    public db?: DB;

    /**
     * 创建用户
     * @description
     * 1. 验证 name 长度 [3, 15]
     * 2. 验证 age 范围 [0, 120]
     * 3. 验证失败 → 抛出 Error，不执行后续步骤
     * 4. 调用 this.db!.save(user)
     * @throws Error 如果 name 长度不在 [3, 15]
     * @throws Error 如果 age 不在 [0, 120]
     * @edge-cases age = 0 → 合法；age = 120 → 合法
     */
    public abstract create(user: User): void;
}
```

> 注意：`// @autogen` 和 `// @AutoGen` 是**纯注释**，不需要 import 任何依赖。

---

### Phase 2：aesc-gen（Abstract Class → impl + DI 容器）

触发 `/aesc-gen` skill。

```
Scanner (TS) → Agent 逐类生成 → PostProcessor (TS) → ContainerGen (TS)
```

1. **Scanner**：扫描 `// @autogen` 标记的 abstract class，输出 `.aesc-scan.json`
2. **Agent**：读取每个 class 的 JSDoc，**只写方法体，不修改接口结构**
3. **PostProcessor**：编译检查，自动修复 `implements→extends`、删除重复 property
4. **ContainerGen**：根据 `// @AutoGen` 属性生成类型安全的 DI 容器

生成的文件一律放在 `src/generated/`，由工具链管理，**人类不直接编辑**（如需手改，先 `lock`）。

---

### Phase 3：aesc-test（Abstract Class → 黑盒测试）

触发 `/aesc-test` skill。

**铁律：只读 abstract class 的 JSDoc，严禁读任何 impl 文件。**

测试用例来源：

| JSDoc Tag | 对应测试类型 |
|-----------|------------|
| `@description` 步骤 | Happy path |
| `@throws [条件]` | 每个 throws → 一个负向测试 |
| `@edge-cases` | 每个边界值 → 一个测试 |
| `@returns` | 返回值验证 |

每个测试带 `// 来源: [JSDoc tag]` 注释，测试失败时能精确回溯到哪个契约被违反。

---

## 关键设计决策

### 为什么不用装饰器？

早期使用 `@AutoGen` 装饰器，需要 `import { AutoGen } from 'aesc'`，导致用户项目必须依赖 aesc 包。

现在改为 `// @AutoGen` 注释，ts-morph 通过 `prop.getLeadingCommentRanges()` 识别，**零运行时依赖**。

### 为什么不完全依赖 AI 自动生成？

「之前对于 AI 的能力的估计过于乐观了，预期中的 AI 自主生成没有出现，目前幻觉还是太严重了。」

所以：Scanner / PostProcessor / ContainerGen 全部是确定性 TS 脚本，AI 只负责「理解 JSDoc 并填写方法体」这一件事，幻觉的破坏范围被限制在单个方法的实现内。

### lock 机制

```bash
bun src/lock-manager.ts lock src/generated/db.impl.ts   # 手动改过的文件，保护不被覆盖
bun src/lock-manager.ts list                            # 查看当前锁定列表
bun src/lock-manager.ts unlock src/generated/db.impl.ts # 解锁，允许重新生成
```

---

## Demo

`demo/` 目录包含一个 7 服务电商系统示例（UserService、DB、CacheService、ProductService、NotificationService、CustomerService、OrderService），验证跨服务 DI 依赖注入和复杂业务流程（订单状态机）。

```bash
cd demo && bun src/ecommerce-demo.ts   # 运行集成演示（40 test cases）
cd demo && bun test                   # 黑盒契约测试（96 cases）
```

---

## 项目结构

```
AetherScript/
  src/                    # aesc 工具链（确定性 TS 脚本）
    scanner.ts
    post-processor.ts
    container-gen.ts
    lock-manager.ts
    decorators.ts         # 历史遗留，已不使用
  test/                   # 工具链自身的回归测试
    scanner.test.ts       # 10 capability checkpoints
    post-processor.test.ts
    container-gen.test.ts
    lock-manager.test.ts
  demo/                   # 电商示例项目
    src/
      entity/             # 数据实体（Customer, Order, Product, User）
      service/            # Abstract Class 契约
      generated/          # AI 生成的 impl + DI 容器（工具链管理）
    test/                 # 黑盒业务测试
  .agents/skills/
    aesc-pre/             # 需求收集 + Abstract Class 脚手架
    aesc-gen/             # impl 生成流程
    aesc-test/            # 黑盒测试生成流程
```
