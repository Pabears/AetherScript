// ============================================================
// Fleet Commander — Seed Data
// Creates a demo task with aesc-pre phase completed
// Run: bun src/seed.ts
// ============================================================

import {
  createTask,
  updatePhaseStep,
  completePhase,
} from './state.ts'

const PRD_CONTENT = `# 产品需求文档 (PRD)
## 项目：智能订单管理系统

### 一、背景与目标
在高并发电商场景下，现有订单系统存在以下问题：
1. 订单状态流转逻辑分散，难以维护
2. 缺乏实时库存核查机制，超卖频发
3. 支付回调处理串行，性能瓶颈明显

本次目标：构建一套基于事件驱动的订单管理核心引擎，支持每秒 5000 单的处理能力，并提供完整的状态机抽象。

### 二、核心功能模块

#### 2.1 订单状态机
- 定义标准状态转换图：PENDING → PAID → PROCESSING → SHIPPED → DELIVERED / CANCELLED
- 状态变更需触发领域事件（OrderStatusChanged）
- 支持状态回滚（仅限特定条件）

#### 2.2 库存预占服务
- 下单时原子性预占库存（乐观锁 + 重试）
- 超时未支付自动释放预占
- 提供批量预占 API，降低网络往返次数

#### 2.3 支付回调处理器
- 幂等设计（去重 by paymentId）
- 异步消费队列，解耦支付通道
- 支持多支付渠道适配器（支付宝/微信/Stripe）

### 三、非功能性要求
- 吞吐量：≥ 5000 TPS（峰值）
- 延迟：P99 < 50ms
- 可用性：99.9% uptime
- 数据一致性：最终一致（补偿机制兜底）

### 四、技术约束
- TypeScript + Bun 运行时
- 禁止使用 ORM，直接使用 SQL Builder
- 所有外部依赖通过依赖注入容器管理
`

const ABSTRACT_CLASSES = [
  'AbstractOrderStateMachine',
  'AbstractInventoryService',
  'AbstractPaymentCallbackHandler',
  'AbstractOrderRepository',
  'AbstractEventBus',
]

async function seed() {
  console.log('🌱 开始写入演示数据...\n')

  // 创建任务
  const task = createTask(
    '智能订单管理系统',
    '构建高并发订单引擎：事件驱动状态机、库存预占、支付回调处理，目标 5000 TPS，P99 < 50ms'
  )
  console.log(`✅ 任务已创建：${task.id}`)

  // ── aesc-pre 阶段步骤 ────────────────────────────────────
  const now = new Date()
  const t = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString()

  // 步骤1：需求解析官
  await updatePhaseStep(task.id, 'pre', {
    role: '需求解析官',
    emoji: '🔍',
    status: 'done',
    startedAt: t(0),
    completedAt: t(8000),
    summary: '解析用户需求，识别核心业务域：订单状态流转、库存管理、支付处理。提取非功能性约束：5000 TPS、P99<50ms。确认技术栈：TypeScript + Bun，依赖注入架构。输出结构化需求矩阵，标记高优先级模块 3 个。',
    fullOutput: '完整需求解析报告（略）',
  })

  // 步骤2：架构暴君
  await updatePhaseStep(task.id, 'pre', {
    role: '架构暴君',
    emoji: '👑',
    status: 'done',
    startedAt: t(8000),
    completedAt: t(22000),
    summary: '裁定系统架构：事件驱动 + CQRS 分离读写。强制要求：所有外部依赖抽象为 interface，状态机使用 Abstract Class 封装转换逻辑。识别 5 个核心抽象点，颁布架构铁律：禁止跨模块直接调用，必须通过事件总线解耦。',
    fullOutput: '架构裁定书（略）',
  })

  // 步骤3：PRD 女王
  await updatePhaseStep(task.id, 'pre', {
    role: 'PRD 女王',
    emoji: '👸',
    status: 'done',
    startedAt: t(22000),
    completedAt: t(45000),
    summary: '将架构裁定转化为精确的产品需求文档。定义 5 个核心模块的功能边界、输入/输出契约、异常处理策略。特别标注："库存预占必须是原子操作，超时 30 秒自动释放；支付回调必须幂等，去重窗口 24 小时"。',
    fullOutput: PRD_CONTENT,
  })

  // 步骤4：抽象类设计师
  await updatePhaseStep(task.id, 'pre', {
    role: '抽象类设计师',
    emoji: '🏗️',
    status: 'done',
    startedAt: t(45000),
    completedAt: t(68000),
    summary: `基于 PRD 设计 ${ABSTRACT_CLASSES.length} 个 Abstract Class 骨架：${ABSTRACT_CLASSES.join('、')}。每个类标注 @autogen，定义方法签名、参数类型、返回值、异常类型。关键决策：OrderStateMachine 使用 Template Method 模式，EventBus 使用观察者模式。`,
    fullOutput: '抽象类设计文档（略）',
  })

  // 步骤5：质量守门人
  await updatePhaseStep(task.id, 'pre', {
    role: '质量守门人',
    emoji: '🛡️',
    status: 'done',
    startedAt: t(68000),
    completedAt: t(78000),
    summary: '审查 PRD 完整性：✅ 功能覆盖度 100%，✅ 非功能约束可测量，✅ 抽象类职责清晰无重叠。发现并修正 2 处遗漏：支付超时重试策略未定义 → 已补充；库存并发冲突处理策略模糊 → 已精确化。LGTM，放行进入 aesc-gen 阶段。',
    fullOutput: '质量检查报告（略）',
  })

  // 完成 aesc-pre 阶段
  await completePhase(task.id, 'pre', {
    prd: PRD_CONTENT,
    abstractClasses: ABSTRACT_CLASSES,
  })

  console.log('✅ aesc-pre 阶段已完成')
  console.log(`\n🎯 演示任务 ID: ${task.id}`)
  console.log(`📋 任务名称: ${task.name}`)
  console.log(`📦 抽象类: ${ABSTRACT_CLASSES.join(', ')}`)
  console.log('\n✨ 种子数据写入完成！启动看板：bun src/index.ts')
}

seed().catch(console.error)
