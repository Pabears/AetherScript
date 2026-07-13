# AetherScript 开发工作流指南

本文档为参与 aesc 项目开发的 Agent 提供工作规范和项目背景。

## 项目定位

aesc 是一套「AI-Assisted Development You Can Trust」工具链，核心哲学：

- **Abstract Class = 唯一真相来源**：人类定义契约（方法签名 + JSDoc），AI 只填实现
- **确定性工具 + AI 智能**：Scanner/PostProcessor/ContainerGen 是确定性 TS 脚本；只有 impl 生成和测试推导交给 AI
- **零依赖注解**：`// @autogen` 和 `// @AutoGen` 是纯注释，用户项目无需 import aesc 包

## 标注语法

```typescript
// @autogen                        ← 标记整个 abstract class 需要生成 impl
export abstract class UserService {
    // @AutoGen                    ← 标记属性需要 DI 注入（ts-morph 通过 getLeadingCommentRanges 识别）
    public db?: DB;

    public abstract create(user: User): void;
}
```

> ⚠️ **已废弃**：`@AutoGen` 装饰器（`import { AutoGen } from 'aesc'`）。一律使用注释语法。

## 工具链调用

```bash
bun src/scanner.ts --project <目标项目>         # 扫描 → .aesc-scan.json
bun src/post-processor.ts --project <目标项目>  # 验证 + 修复 impl
bun src/container-gen.ts --project <目标项目>   # 生成 DI 容器
bun src/lock-manager.ts list                   # 查看已锁定文件
bun src/lock-manager.ts lock <file>            # 保护手动修改的 impl
bun src/lock-manager.ts unlock <file>          # 解锁
```

## 测试

```bash
bun test              # aesc 工具回归测试（31 cases，test/ 目录）
bun run test:demo     # demo 黑盒测试（96 cases，demo/test/ 目录）
bun run test:all      # 全跑
```

回归测试覆盖 4 个工具的关键能力点，每次改动后必须全绿才算完成。

## 目录结构

```
src/                  # 工具链（确定性，人类维护）
test/                 # 工具链回归测试
demo/                 # 电商示例（7 服务）
  src/service/        # Abstract Class 契约（人类定义）
  src/generated/      # impl + container（工具链生成，谨慎手改）
  test/               # 黑盒业务测试
.agents/skills/       # Antigravity Skills
  aesc-pre/           # 需求收集 → Abstract Class
  aesc-gen/           # Abstract Class → impl
  aesc-test/          # Abstract Class → 黑盒测试
```

## 核心原则

1. **千万不要修改 `src/generated/` 中的文件**（除非先 lock），那些文件由工具链管理
2. **改动工具链后必须重跑 `bun test`**，保持回归测试全绿
3. **aesc-test 严禁读 impl 文件**：测试只能来自 abstract class 的 JSDoc 契约
4. **JSDoc 是 impl 生成的 prompt**：越详细越好，`@description` 步骤编号、`@throws` 条件、`@edge-cases` 边界值缺一不可
