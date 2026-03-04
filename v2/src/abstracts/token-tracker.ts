import type { TokenUsage, CostReport } from './types.ts'

export interface CostConfig {
  maxTotalCostUsd: number
  warnThresholdPercent?: number
}

export abstract class AbstractTokenTracker {
  abstract record(callId: string, purpose: string, usage: TokenUsage): void
  abstract canProceed(estimatedTokens: number): boolean
  abstract getReport(): CostReport
  abstract reset(): void
}
