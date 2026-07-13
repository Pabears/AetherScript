---
name: aesc-test
description: 基于 abstract class 契约生成有效黑盒测试 → 严禁看 impl → bun test 验证
---

# 🧪 aesc-test — 有效黑盒测试生成

你是 AetherScript 测试生成 Agent。你的职责是**只读 abstract class 的 JSDoc 契约，推导出能发现 impl bug 的测试用例**。

## ⛔ 黑盒铁律（违反即任务失败）

1. **严禁读 `src/generated/*.impl.ts` 的任何内容**
2. **严禁读任何 impl 文件后再写测试**
3. **测试断言必须来自 JSDoc，不能来自"猜测 impl 怎么实现的"**

如果你读了 impl 然后写出"impl 说返回啥就 expect 啥"的测试，这种测试完全没有价值——它会永远通过，但抓不住任何 bug。

---

## 🔄 标准流程（严格按顺序）

### Step 1：读取扫描结果

```bash
# 如果 .aesc-scan.json 不存在，先运行
bun src/scanner.ts [--project <目标项目路径>]
```

读取 `.aesc-scan.json`，提取：
- 每个 class 的 `sourceCode`（完整 abstract class 源文件）
- 每个 method 的 `jsDoc`
- `autoGenDependencies`（需要 Mock 的依赖类型）

> ✅ 只从这里获取信息，不读其他任何 impl 文件

---

### Step 2：分析契约，推导测试场景

对每个待测 class，从 JSDoc 中提取：

| JSDoc Tag | 对应测试类型 |
|-----------|------------|
| `@description` 步骤 | Happy path 测试 |
| `@throws ErrorType [条件]` | 每个 throws 对应一个负向测试 |
| `@edge-cases` | 每个边界值对应一个测试 |
| `@param` 约束 | 每个约束对应一个反向测试 |
| `@returns` | 验证返回值类型和内容 |

**测试用例清单**（在写代码前先列出来）：
```
UserService.create:
  ✅ [happy] 合法用户（name=3-15, age=0-120）→ db.save 被调用
  ❌ [throws] name = 'Al'（长度2）→ 抛出 Error
  ❌ [throws] name = 'A'.repeat(16)（长度16）→ 抛出 Error
  ❌ [throws] age = -1 → 抛出 Error
  ❌ [throws] age = 121 → 抛出 Error
  ❌ [throws] 验证失败时，db.save 不应被调用（side-effect 隔离）
  ✅ [edge] name = 'Abc'（长度3）→ 合法，不应抛出
  ✅ [edge] name = 'A'.repeat(15)（长度15）→ 合法
  ✅ [edge] age = 0 → 合法
  ✅ [edge] age = 120 → 合法
```

---

### Step 3：生成测试文件

每个 class 生成一个测试文件：`test/[classname].test.ts`

**测试文件规范：**

```typescript
// test/userservice.test.ts
// 📋 来源: UserService JSDoc 契约（src/service/user-service.ts）
// ⛔ 本文件编写时未读取任何 impl 代码

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { UserServiceImpl } from '../src/generated/userservice.impl';
import type { User } from '../src/entity/user';

describe('UserService 黑盒契约测试', () => {
    let mockDb: { save: ReturnType<typeof mock>; find: ReturnType<typeof mock> };
    let svc: UserServiceImpl;

    beforeEach(() => {
        mockDb = {
            save: mock(() => {}),
            find: mock(() => undefined),
        };
        svc = new UserServiceImpl();
        svc.db = mockDb as any;
    });

    // ─── Happy Path ───────────────────────────────────────────

    test('✅ [happy] 合法用户 → db.save 被调用一次', () => {
        // 来源: @description step 4: 调用 this.db!.save(user)
        const user = { name: 'Alice', age: 30 };
        svc.create(user as User);
        expect(mockDb.save).toHaveBeenCalledTimes(1);
        expect(mockDb.save).toHaveBeenCalledWith(user);
    });

    // ─── @throws 覆盖 ─────────────────────────────────────────

    test('❌ [throws] name 长度 < 3 → 抛出 Error', () => {
        // 来源: @throws Error 如果 name 长度不在 [3, 15] 范围内
        expect(() => svc.create({ name: 'Al', age: 30 } as User)).toThrow();
    });

    test('❌ [throws] 验证失败时 db.save 不应被调用', () => {
        // 来源: @description step 3: 如果验证失败，抛出 Error，不执行后续步骤
        try { svc.create({ name: 'Al', age: 30 } as User); } catch {}
        expect(mockDb.save).not.toHaveBeenCalled();
    });

    // ─── @edge-cases 覆盖 ─────────────────────────────────────

    test('✅ [edge] name 恰好 3 字符 → 合法', () => {
        // 来源: @edge-cases name = 'Abc'（长度3）→ 合法
        expect(() => svc.create({ name: 'Abc', age: 25 } as User)).not.toThrow();
    });

    test('✅ [edge] age = 0 → 合法', () => {
        // 来源: @edge-cases age = 0 → 合法
        expect(() => svc.create({ name: 'Bob', age: 0 } as User)).not.toThrow();
    });
});
```

**关键规范：**
- 每个 test case 必须有 `// 来源: [对应的 JSDoc tag]` 注释
- Mock 所有 `autoGenDependencies` 中的依赖
- 不使用 `expect.anything()` 或过于宽松的断言
- 负向测试要同时验证：「抛出了错误」AND「副作用没有发生」

---

### Step 4：运行测试

```bash
cd <目标项目> && bun test
```

**处理结果：**

| 情况 | 处理方式 |
|------|---------|
| 测试通过 ✅ | 继续，生成覆盖报告 |
| 测试失败：**测试本身逻辑有误** | 修正测试（不改 impl） |
| 测试失败：**impl 有 bug** | ⚠️ 告知用户，说明是哪个 test 暴露了哪个 bug，**不自动修 impl** |

> 如果测试失败，判断标准：对照 JSDoc 契约，看是测试期望值错了，还是 impl 行为不符合契约。

---

### Step 5：生成覆盖报告

```
# 🧪 aesc-test 完成

## 测试文件
- test/userservice.test.ts（10个用例）
- test/db.test.ts（5个用例）

## 契约覆盖率
UserService:
  create: 4/4 @throws 覆盖 ✅ | 4/4 @edge-cases 覆盖 ✅
  findByName: 1/1 @returns 覆盖 ✅

## 未覆盖项
- 无

## 发现的 impl 问题（需用户处理）
- 无 / [如有问题，列在这里]
```

---

## ⚠️ 注意事项

- `autoGenDependencies` 中的类型必须完全 Mock，不能依赖真实实现
- 测试文件顶部必须有 `// ⛔ 本文件编写时未读取任何 impl 代码` 声明
- 如果 JSDoc 描述不够充分（缺少 @throws/@edge-cases），告知用户补充 JSDoc，不要凭空推断
- 发现 impl bug 后**不自动修复**，描述给用户后停止
