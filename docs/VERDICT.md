# AetherScript 2.0 — 三巨头最终裁决

> 评审人：架构暴君 + QA黑客 + 安全死心眼（每类独立评审，完整输出）
> 日期：2026-03-04 | 方法：每类单独 sub-agent，input重，output精

---

## 总体结论

**性能派全组淘汰**（7/7 不继承抽象类，脱离 DI 契约）。
最终方案：Scanner/PromptSanitizer/LLMClient/Validator/Pipeline 以**优雅派**为基底；TokenTracker/FileWriter 以**稳健派**为基底；各类按下方说明融合。

---

## 1. Scanner

| 方案 | 架构暴君 | QA黑客 | 安全死心眼 | 综合 |
|------|---------|--------|-----------|------|
| 稳健派 | 8.5 | 8 | 8 | **8.2** |
| 性能派 | 3 | 2 | 2 | **2.3** ❌ |
| **优雅派** | **9** | **8.5** | **8.5** | **8.7** ⭐ |

**选优雅派。** 融合：
- 性能派的 SHA-256 hash 缓存（增量扫描跳过未变文件）
- `Promise.all` 改为带并发上限（p-limit，防 fd 耗尽）
- 稳健派的文件大小限制 + 排除目录列表
- Err 结果不静默丢弃，改为 warn 日志收集

**阻塞级安全：**
- `projectDir` 必须 `path.resolve` + 白名单校验，防路径穿越
- 补充 symlink 检测（`lstat`），防 `/etc/passwd` 等敏感文件被读

---

## 2. PromptSanitizer

| 方案 | 架构暴君 | QA黑客 | 安全死心眼 | 综合 |
|------|---------|--------|-----------|------|
| 稳健派 | 7 | 8 | 7 | **7.3** |
| 性能派 | 3 | 3 | 2 | **2.7** ❌ |
| **优雅派** | **9** | **7** | **6** | **7.3** ⭐ |

**选优雅派（Rule Chain 架构）。** 融合：
- 稳健派的 XML 转义 + 长度截断（MAX_SOURCE_LENGTH）作为 Rule 插入末端
- 稳健派的 chat template 注入模式（`[INST]`、`<|im_start|>` 等）补入规则链
- 稳健派的逐类 try-catch 容错 + `Object.freeze` 冻结输出
- 输入防御校验（scanResult 为 null/空时 fail-fast）

**阻塞级安全：**
- 🔴 规则链入口必须加 `source.normalize('NFKC')`——同形字符（Cyrillic `а` 替代 Latin `a`）可绕过所有正则
- 🔴 `Symbol.for('SANITIZED_SYMBOL')` → `Symbol('SANITIZED_SYMBOL')`（全局可伪造，影响抽象层）
- 🔴 补充 `methodSignatures` 内容的净化（三组均遗漏）

---

## 3. LLMClient

| 方案 | 架构暴君 | QA黑客 | 安全死心眼 | 综合 |
|------|---------|--------|-----------|------|
| 稳健派 | 8 | 7 | 8 | **7.7** |
| 性能派 | 3 | 2 | 1 | **2.0** ❌ |
| **优雅派** | **9** | **7** | **6** | **7.3** ⭐ |

**选优雅派（Strategy 架构 + 错误分类 + 指数退避）。** 融合：
- 稳健派的 `tool_use` 强制结构化输出，替换优雅派的正则 JSON 提取
- 稳健派的构造时 API key 空值校验（fail-fast throw）
- 性能派的 `keepAlive` 连接池配置
- 方法签名对齐：`generate(SanitizedPayload) → UntrustedGenerationResult`

**阻塞级安全：**
- 🔴 优雅派正则 `text.match(/\{[\s\S]*\}/)` 可被 prompt 注入构造恶意 JSON → 必须换 `tool_use`
- 🔴 所有路径加请求超时（`AbortController` + timeout），防进程永久挂起
- 🔴 error catch 中过滤 API Key，防密钥泄露到日志

---

## 4. TokenTracker

| 方案 | 架构暴君 | QA黑客 | 安全死心眼 | 综合 |
|------|---------|--------|-----------|------|
| **稳健派** | **8.5** | **8** | **9** | **8.5** ⭐ |
| 性能派 | 3 | 2 | 1 | **2.0** ❌ |
| 优雅派 | 9 | 7 | 6.5 | **7.5** |

**选稳健派。** 优雅派 `record()` 超预算仍写入（软限制），不可接受。融合：
- 优雅派的纯函数 `appendEntry` 抽为独立可测工具函数
- 优雅派的 `snapshot()` API + `onWarning` 回调替代 `console.warn` 硬编码
- 优雅派的 Builder 静态工厂 `withConfig()` 作为可选构造路径
- 补全接口：`checkBudget(): BudgetStatus`、`getTotalCost()`、`getSessionUsage()`（三组均缺）

**阻塞级安全：**
- 🔴 优雅派无 cost limit 拦截，circuit breaker 形同虚设，不可采用
- 🔴 三组均未实现 `checkBudget() → BudgetStatus`，Pipeline 无法获取结构化预算状态

---

## 5. Validator

| 方案 | 架构暴君 | QA黑客 | 安全死心眼 | 综合 |
|------|---------|--------|-----------|------|
| 稳健派 | 8 | 8 | 7 | **7.7** |
| 性能派 | 3 | 2 | 2 | **2.3** ❌ |
| **优雅派** | **9** | **7** | **6** | **7.3** ⭐ |

**选优雅派（Strategy 模式）。** 融合：
- 稳健派的 ts-morph AST 解析做契约验证和 globals 扫描，替换优雅派正则方案（可被注释/字符串欺骗）
- 性能派的内存 `ts.createProgram` 编译检查，替换 `execSync('npx tsc')` 子进程（消除命令注入风险）
- 稳健派的防御性输入校验 + `DEFAULT_BANNED_IMPORTS/GLOBALS` 默认值
- 优雅派的 `os.tmpdir()` 替换稳健派的项目内临时目录
- `bannedPatterns` 命中改为 error（稳健派降为 warning，不可接受）

**阻塞级安全：**
- 🔴 补全 `node:` 前缀变体（`'node:fs'`、`'node:child_process'` 等）到 banned list
- 🔴 添加动态 `import()` 和 `require()` 检测
- 🔴 添加 `globalThis['eval']`、别名赋值（`const x = eval`）检测
- 🔴 `execSync`/`execAsync` 的 cwd 路径必须校验无 shell 元字符

---

## 6. FileWriter

| 方案 | 架构暴君 | QA黑客 | 安全死心眼 | 综合 |
|------|---------|--------|-----------|------|
| 稳健派 | 8 | 7 | 7 | **7.3** |
| 性能派 | 4 | 5 | 3 | **4.0** ❌ |
| **优雅派** | **9** | **8** | **7** | **8.0** ⭐ |

**选优雅派（RAII Transaction + 正确回滚）。** 融合：
- 性能派的 `Promise.all` 并发写临时文件 + `.bak` 备份作为持久化回滚补充
- 稳健派的防御性参数校验
- commit 阶段改为同分区 `rename` 实现真原子写入（稳健派思路）

**阻塞级安全：**
- 🔴 三组均缺路径穿越检查：`file.filename` 含 `../../` 可写任意位置，必须校验 `resolve` 后路径在 `generatedDir` 内
- 🔴 优雅派 `existsSync` TOCTOU 竞态，改为 `try/catch + readFile`
- 🔴 性能派 `path.basename` 碰撞 bug：同名不同目录文件互相覆盖（数据丢失）

---

## 7. Pipeline

| 方案 | 架构暴君 | QA黑客 | 安全死心眼 | 综合 |
|------|---------|--------|-----------|------|
| 稳健派 | 8.5 | 8 | 7.5 | **8.0** |
| 性能派 | 2 | 1 | 1 | **1.3** ❌ |
| **优雅派** | **9** | **7** | **8** | **8.0** ⭐ |

**选优雅派（TypedEventBus + Builder + timed 组合）。** 融合：
- 稳健派的 Write 阶段失败后 `writer.rollback()` 逻辑
- 稳健派的 config 防御性校验
- 稳健派的完整 `DEFAULT_DANGEROUS_API_CONFIG`（fs/os/net/http/https/crypto/eval/Function）
- 稳健派的 LLM ping 连通性预检

**阻塞级安全：**
- 🔴 优雅派 `DEFAULT_DANGEROUS_API_CONFIG.bannedImports` 仅含 `child_process`，必须扩充
- 🔴 稳健派 hook 异常被 catch 吞掉，恶意 hook 可隐藏攻击痕迹，改为结构化审计日志
- 🔴 移除 `process.exitCode = 1` 副作用（库代码不应直接改进程状态）

---

## 最终选型汇总

| 类 | 基底 | 综合最高分 |
|----|------|-----------|
| Scanner | 优雅派 | 8.7 |
| PromptSanitizer | 优雅派 | 7.3（同分，优雅架构胜） |
| LLMClient | 优雅派 | 7.7→7.3（优雅架构胜） |
| TokenTracker | **稳健派** | 8.5 |
| Validator | 优雅派 | 7.7→7.3（优雅架构胜） |
| FileWriter | **优雅派** | 8.0 |
| Pipeline | 优雅派 | 8.0（同分，优雅架构胜） |

---

## 全局阻塞级安全修复清单

1. `Symbol.for()` → `Symbol()`（PromptSanitizer 抽象层）
2. `source.normalize('NFKC')` 加到 PromptSanitizer 规则链入口
3. LLMClient `tool_use` 模式 + 请求超时 + API Key 日志过滤
4. Validator `node:` 前缀 + 动态 import + globalThis 检测 + 内存编译
5. FileWriter 路径穿越校验（`resolve` 后必须在 `generatedDir` 内）
6. Scanner `projectDir` realpath + symlink 检测
7. Pipeline 移除 `process.exitCode` 副作用，hook 异常改审计日志

---

## 下一步

按以上裁决生成7个融合后的最终实现，写入 `/workspace/AetherScript/v2/src/final/`。
