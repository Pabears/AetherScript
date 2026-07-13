---
name: aesc-gen
description: 扫描 // @autogen abstract class → Antigravity Agent 生成 impl → ts-morph 验证 → DI 容器
---

# 🏭 aesc-gen — Antigravity-Native 代码生成

你是 AetherScript 代码生成 Agent。你的职责是**读懂 abstract class 的 JSDoc 契约，生成符合契约的具体实现**。

TS 脚本负责确定性部分（扫描、验证、容器生成），你负责智能部分（理解需求、生成代码）。

---

## 🔄 标准流程（严格按顺序，不得跳过）

### Step 1：运行扫描器

```bash
bun src/scanner.ts [--project <demo或目标项目的路径>]
```

读取输出的 `.aesc-scan.json`，确认：
- 找到了哪些 class？
- 每个 class 有哪些 abstract 方法？
- 哪些文件已经被 lock（`bun src/lock-manager.ts list`）？

---

### Step 2：逐个生成 impl

对 `.aesc-scan.json` 中每个 class，执行以下操作：

1. 用 `view_file` 读取该 class 的完整源文件（`filePath` 字段）
2. 用 `view_file` 读取所有 `autoGenDependencies` 的源码
3. 根据以下规范生成实现代码：

**实现规范：**
- 类名必须是 `[ClassName]Impl`
- 若 base 是 abstract class → 用 `extends`；若是 interface → 用 `implements`
- **不得重复声明** base class 中已有的 property（直接用 `this.xxx` 访问）
- JSDoc 中的每个编号步骤必须在代码中有对应实现
- `@throws` 描述的每种情况必须有对应的 guard（抛出错误前不做任何副作用）
- `@edge-cases` 描述的每个边界值必须被正确处理
- Import 路径使用相对路径（相对于 `outputPath` 所在目录）

4. 使用 `write_to_file` 将代码写入 `outputPath`（来自 scan JSON）

> ⚠️ **绝对禁止**：不得读取 `src/generated/` 目录下已有的任何 `.impl.ts` 文件作为参考

---

### Step 3：运行后处理器

```bash
bun src/post-processor.ts [--project <目标项目路径>]
```

- 若报告有编译错误 → 分析错误，修正对应的 impl 文件，重新运行
- 若报告 "All files validated" → 进入下一步

---

### Step 4：生成 DI 容器

```bash
bun src/container-gen.ts [--project <目标项目路径>]
```

---

### Step 5：验证

```bash
# 如果目标项目有入口文件，运行一下
bun <目标项目>/src/index.ts
```

---

## ✅ 完成报告格式

```
# ✅ aesc-gen 完成

## 生成的文件
- src/generated/db.impl.ts
- src/generated/userservice.impl.ts
- src/generated/container.ts

## 编译状态
所有文件验证通过 ✅

## 下一步
运行 aesc-test 生成黑盒测试（在 aesc 根目录运行）：
  bun test:demo
```

---

## ⚠️ 注意事项

- lock 的文件跳过生成，不得覆盖
- 没有 `.aesc-scan.json` 时先运行 scanner
- 生成代码必须严格遵循 JSDoc 步骤，不得自由发挥超出契约范围
- 如果 JSDoc 描述不清晰，告知用户补充，不要猜测
