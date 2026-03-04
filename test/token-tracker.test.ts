import { test, describe, expect, beforeEach } from 'bun:test'
import { TokenTracker, CostLimitExceededError } from '../src/generated/token-tracker.impl.ts'

const mkUsage = (cost: number) => ({
  inputTokens: 100,
  outputTokens: 50,
  estimatedCostUsd: cost,
})

let tracker: TokenTracker

describe('TokenTracker', () => {
  beforeEach(() => {
    tracker = new TokenTracker({ maxTotalCostUsd: 1.0, warnThresholdPercent: 80 })
  })

  // 1. record() + getReport() 累计正确
  test('record() accumulates and getReport() returns correct totals', () => {
    tracker.record('c1', 'test', mkUsage(0.3))
    tracker.record('c2', 'test', mkUsage(0.2))
    const r = tracker.getReport()
    expect(r.callCount).toBe(2)
    expect(r.totalCostUsd).toBeCloseTo(0.5)
    expect(r.totalInputTokens).toBe(200)
    expect(r.totalOutputTokens).toBe(100)
  })

  // 2. reset() 后状态归零
  test('reset() clears all state', () => {
    tracker.record('c1', 'test', mkUsage(0.5))
    tracker.reset()
    const r = tracker.getReport()
    expect(r.callCount).toBe(0)
    expect(r.totalCostUsd).toBe(0)
    expect(r.totalInputTokens).toBe(0)
    expect(r.totalOutputTokens).toBe(0)
  })

  // 3. canProceed() 预算充足/耗尽
  test('canProceed() returns true when budget is sufficient', () => {
    tracker.record('c1', 'test', mkUsage(0.3))
    expect(tracker.canProceed(1000)).toBe(true)
  })

  test('canProceed() returns false when budget is exhausted', () => {
    tracker.record('c1', 'test', mkUsage(0.99))
    // 剩余 $0.01，以观测到的平均每 token 成本估算大量 token 会超限
    expect(tracker.canProceed(10_000_000)).toBe(false)
  })

  test('canProceed() returns false when already at limit', () => {
    // 精确打满 limit
    tracker.record('c1', 'test', mkUsage(1.0))
    expect(tracker.canProceed(0)).toBe(false)
  })

  // 4. onWarning 仅触发一次
  test('onWarning callback fires once when threshold is crossed', () => {
    const calls: string[] = []
    const t = new TokenTracker(
      { maxTotalCostUsd: 1.0, warnThresholdPercent: 80 },
      (msg) => calls.push(msg),
    )
    t.record('c1', 'test', mkUsage(0.79)) // 79% — 未触发
    expect(calls.length).toBe(0)
    t.record('c2', 'test', mkUsage(0.02)) // 81% — 触发
    expect(calls.length).toBe(1)
    t.record('c3', 'test', mkUsage(0.01)) // 82% — 不再触发
    expect(calls.length).toBe(1)
  })

  // 5. 超限时 record() 抛出 CostLimitExceededError
  test('record() throws CostLimitExceededError when over budget', () => {
    tracker.record('c1', 'test', mkUsage(0.9))
    expect(() => tracker.record('c2', 'test', mkUsage(0.2))).toThrow(CostLimitExceededError)
  })

  test('thrown error carries correct cost metadata', () => {
    tracker.record('c1', 'test', mkUsage(0.9))
    try {
      tracker.record('c2', 'test', mkUsage(0.2))
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(CostLimitExceededError)
      const err = e as CostLimitExceededError
      expect(err.currentCostUsd).toBeCloseTo(0.9)
      expect(err.attemptedCostUsd).toBeCloseTo(0.2)
      expect(err.limitUsd).toBeCloseTo(1.0)
    }
  })

  // 6. 超限后再次 record() 仍然拒绝（entry 未被写入）
  test('record() continues to reject after limit exceeded', () => {
    tracker.record('c1', 'test', mkUsage(0.9))
    expect(() => tracker.record('c2', 'test', mkUsage(0.2))).toThrow(CostLimitExceededError)
    // 第二次再试也拒绝，且总额未变
    expect(() => tracker.record('c3', 'test', mkUsage(0.05))).toThrow(CostLimitExceededError)
    expect(tracker.getReport().callCount).toBe(1)
    expect(tracker.getReport().totalCostUsd).toBeCloseTo(0.9)
  })

  // 7. getReport() 返回深拷贝
  test('getReport() returns a deep copy; external mutation does not affect internal state', () => {
    tracker.record('c1', 'test', mkUsage(0.3))
    const r1 = tracker.getReport()
    // 修改 breakdown 中的 usage
    r1.breakdown[0].usage.estimatedCostUsd = 9999
    r1.totalCostUsd = 9999
    const r2 = tracker.getReport()
    expect(r2.totalCostUsd).toBeCloseTo(0.3)
    expect(r2.breakdown[0].usage.estimatedCostUsd).toBeCloseTo(0.3)
  })

  // 8. Builder withConfig() 正确构造实例
  test('withConfig() builder creates a functional TokenTracker instance', () => {
    const warningMsgs: string[] = []
    const t = TokenTracker.withConfig({
      maxTotalCostUsd: 2.0,
      warnThresholdPercent: 50,
      onWarning: (msg) => warningMsgs.push(msg),
    })
    expect(t).toBeInstanceOf(TokenTracker)
    t.record('c1', 'build-test', mkUsage(0.5))
    expect(t.getReport().totalCostUsd).toBeCloseTo(0.5)
    // 50% 阈值：0.5/2.0 = 25%，未触发
    expect(warningMsgs.length).toBe(0)
    t.record('c2', 'build-test', mkUsage(0.6))
    // 55%，触发
    expect(warningMsgs.length).toBe(1)
  })
})
