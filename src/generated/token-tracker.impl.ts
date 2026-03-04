// ============================================================
// AetherScript 2.0 — TokenTracker Implementation
// Base: 稳健派 (hard circuit breaker, check-before-write)
// Fused: 优雅派 appendEntry pure fn, onWarning callback,
//        Builder static factory, snapshot() API
// Verdict: 2026-03-04
// ============================================================

import type { TokenUsage, CostReport } from '../abstracts/types.ts';
import { AbstractTokenTracker, type CostConfig } from '../abstracts/token-tracker.ts';

// ─── Error Types ─────────────────────────────────────────────

/**
 * Thrown when a `record()` call would push the total cost
 * beyond the configured `maxTotalCostUsd`.  Hard circuit breaker.
 */
export class CostLimitExceededError extends Error {
  public readonly currentCostUsd: number;
  public readonly attemptedCostUsd: number;
  public readonly limitUsd: number;

  constructor(current: number, attempted: number, limit: number) {
    super(
      `Cost limit exceeded: current $${current.toFixed(6)} + ` +
      `attempted $${attempted.toFixed(6)} > limit $${limit.toFixed(6)}`
    );
    this.name = 'CostLimitExceededError';
    this.currentCostUsd = current;
    this.attemptedCostUsd = attempted;
    this.limitUsd = limit;
  }
}

// ─── Internal Types ──────────────────────────────────────────

/** A single recorded usage entry (immutable after creation). */
interface UsageEntry {
  readonly callId: string;
  readonly purpose: string;
  readonly usage: Readonly<TokenUsage>;
  readonly timestamp: number;
}

/** Structured budget status (裁决要求补全). */
export interface BudgetStatus {
  readonly totalCostUsd: number;
  readonly limitUsd: number;
  readonly remainingUsd: number;
  readonly usagePercent: number;
  readonly isWarning: boolean;
  readonly isExhausted: boolean;
}

/** Options accepted by the builder / withConfig. */
export interface TokenTrackerOptions {
  maxTotalCostUsd: number;
  warnThresholdPercent?: number;
  onWarning?: WarningCallback;
}

export type WarningCallback = (message: string, status: BudgetStatus) => void;

// ─── Pure Utility (fused from 优雅派) ────────────────────────

/**
 * Pure function: creates a new UsageEntry without mutating anything.
 * Extracted as an independently-testable utility per verdict.
 */
export function appendEntry(
  callId: string,
  purpose: string,
  usage: TokenUsage,
): UsageEntry {
  if (!callId || typeof callId !== 'string') {
    throw new TypeError('callId must be a non-empty string');
  }
  if (!purpose || typeof purpose !== 'string') {
    throw new TypeError('purpose must be a non-empty string');
  }
  if (
    typeof usage?.inputTokens !== 'number' ||
    typeof usage?.outputTokens !== 'number' ||
    typeof usage?.estimatedCostUsd !== 'number'
  ) {
    throw new TypeError('usage must contain numeric inputTokens, outputTokens, and estimatedCostUsd');
  }
  if (usage.inputTokens < 0 || usage.outputTokens < 0 || usage.estimatedCostUsd < 0) {
    throw new RangeError('Token counts and cost must be non-negative');
  }

  return Object.freeze({
    callId,
    purpose,
    usage: Object.freeze({ ...usage }),
    timestamp: Date.now(),
  });
}

// ─── Default warn threshold ─────────────────────────────────

const DEFAULT_WARN_THRESHOLD_PERCENT = 80;

// ─── Implementation ──────────────────────────────────────────

export class TokenTracker extends AbstractTokenTracker {
  private readonly maxTotalCostUsd: number;
  private readonly warnThresholdPercent: number;
  private readonly onWarning: WarningCallback | null;

  private entries: UsageEntry[] = [];
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
  private totalCostUsd: number = 0;
  private warningEmitted: boolean = false;

  // ── Constructors ───────────────────────────────────────────

  constructor(config: CostConfig, onWarning?: WarningCallback) {
    super();

    if (config == null || typeof config !== 'object') {
      throw new TypeError('CostConfig is required');
    }
    if (typeof config.maxTotalCostUsd !== 'number' || config.maxTotalCostUsd <= 0) {
      throw new RangeError('maxTotalCostUsd must be a positive number');
    }
    if (
      config.warnThresholdPercent !== undefined &&
      (typeof config.warnThresholdPercent !== 'number' ||
        config.warnThresholdPercent < 0 ||
        config.warnThresholdPercent > 100)
    ) {
      throw new RangeError('warnThresholdPercent must be between 0 and 100');
    }

    this.maxTotalCostUsd = config.maxTotalCostUsd;
    this.warnThresholdPercent = config.warnThresholdPercent ?? DEFAULT_WARN_THRESHOLD_PERCENT;
    this.onWarning = onWarning ?? null;
  }

  /**
   * Builder-style static factory (fused from 优雅派).
   * Provides a fluent alternative to the constructor.
   *
   * @example
   * ```ts
   * const tracker = TokenTracker.withConfig({
   *   maxTotalCostUsd: 5.0,
   *   warnThresholdPercent: 75,
   *   onWarning: (msg) => logger.warn(msg),
   * });
   * ```
   */
  static withConfig(options: TokenTrackerOptions): TokenTracker {
    const { maxTotalCostUsd, warnThresholdPercent, onWarning } = options;
    return new TokenTracker({ maxTotalCostUsd, warnThresholdPercent }, onWarning);
  }

  // ── Abstract method implementations ────────────────────────

  /**
   * Record token usage for a completed LLM call.
   *
   * **Hard circuit breaker (稳健派):** checks budget BEFORE writing.
   * If the call would exceed the limit, throws `CostLimitExceededError`
   * and does NOT record the entry.
   */
  record(callId: string, purpose: string, usage: TokenUsage): void {
    // Pure construction + validation (throws on bad input)
    const entry = appendEntry(callId, purpose, usage);

    // ── Hard budget check (check BEFORE write) ──
    const projectedCost = this.totalCostUsd + entry.usage.estimatedCostUsd;

    if (projectedCost > this.maxTotalCostUsd) {
      throw new CostLimitExceededError(
        this.totalCostUsd,
        entry.usage.estimatedCostUsd,
        this.maxTotalCostUsd,
      );
    }

    // ── Commit entry ──
    this.entries.push(entry);
    this.totalInputTokens += entry.usage.inputTokens;
    this.totalOutputTokens += entry.usage.outputTokens;
    this.totalCostUsd += entry.usage.estimatedCostUsd;

    // ── Warning check (fires once per threshold crossing) ──
    this.maybeEmitWarning();
  }

  /**
   * Check whether a future call with the given estimated token count
   * can proceed without exceeding the budget.
   *
   * Uses a rough cost model: estimates cost proportionally from the
   * average cost-per-token observed so far.  If no calls have been
   * recorded yet, assumes the entire estimated amount as output tokens
   * at a conservative rate ($0.00 — returns true, since we can't
   * estimate without data, but the hard breaker in record() will
   * still enforce the limit).
   */
  canProceed(estimatedTokens: number): boolean {
    if (typeof estimatedTokens !== 'number' || estimatedTokens < 0) {
      return false;
    }

    // If already at or over the limit, deny immediately
    if (this.totalCostUsd >= this.maxTotalCostUsd) {
      return false;
    }

    const remaining = this.maxTotalCostUsd - this.totalCostUsd;

    // Estimate cost of the upcoming call
    const estimatedCost = this.estimateTokenCost(estimatedTokens);

    return estimatedCost <= remaining;
  }

  /**
   * Get a full cost report with per-call breakdown.
   * The returned object is a deep snapshot (no shared references).
   */
  getReport(): CostReport {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCostUsd: this.totalCostUsd,
      callCount: this.entries.length,
      breakdown: this.entries.map((e) => ({
        callId: e.callId,
        purpose: e.purpose,
        usage: { ...e.usage },
        timestamp: e.timestamp,
      })),
    };
  }

  /**
   * Reset all tracked usage.  Clears entries and running totals.
   * Warning state is also reset so it can fire again.
   */
  reset(): void {
    this.entries = [];
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCostUsd = 0;
    this.warningEmitted = false;
  }

  // ── Extended API (裁决要求补全) ────────────────────────────

  /**
   * Return a structured budget status snapshot.
   */
  checkBudget(): BudgetStatus {
    const usagePercent =
      this.maxTotalCostUsd > 0
        ? (this.totalCostUsd / this.maxTotalCostUsd) * 100
        : 0;

    return Object.freeze({
      totalCostUsd: this.totalCostUsd,
      limitUsd: this.maxTotalCostUsd,
      remainingUsd: Math.max(0, this.maxTotalCostUsd - this.totalCostUsd),
      usagePercent,
      isWarning: usagePercent >= this.warnThresholdPercent,
      isExhausted: this.totalCostUsd >= this.maxTotalCostUsd,
    });
  }

  /** Convenience accessor: current total cost in USD. */
  getTotalCost(): number {
    return this.totalCostUsd;
  }

  /**
   * Get cumulative session token usage (input + output).
   */
  getSessionUsage(): { inputTokens: number; outputTokens: number } {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
    };
  }

  /**
   * Immutable snapshot of the current tracker state.
   * Fused from 优雅派: useful for diagnostic/logging without
   * exposing mutable internals.
   */
  snapshot(): Readonly<{
    totalCostUsd: number;
    maxTotalCostUsd: number;
    callCount: number;
    budgetStatus: BudgetStatus;
  }> {
    return Object.freeze({
      totalCostUsd: this.totalCostUsd,
      maxTotalCostUsd: this.maxTotalCostUsd,
      callCount: this.entries.length,
      budgetStatus: this.checkBudget(),
    });
  }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Estimate cost for `tokenCount` tokens based on observed
   * average cost-per-token.  Falls back to a conservative
   * flat rate if no history exists.
   */
  private estimateTokenCost(tokenCount: number): number {
    const totalTokens = this.totalInputTokens + this.totalOutputTokens;

    if (totalTokens > 0 && this.totalCostUsd > 0) {
      // Use observed average cost-per-token
      const avgCostPerToken = this.totalCostUsd / totalTokens;
      return tokenCount * avgCostPerToken;
    }

    // No history yet — use a conservative estimate.
    // Assume output-token pricing for Claude-class models (~$15/1M tokens).
    // This is intentionally conservative so canProceed errs on the side
    // of caution, while the hard breaker in record() is the true gate.
    const CONSERVATIVE_COST_PER_TOKEN = 15 / 1_000_000; // $0.000015
    return tokenCount * CONSERVATIVE_COST_PER_TOKEN;
  }

  /**
   * Emit a warning via the `onWarning` callback when usage
   * crosses the configured threshold.  Fires at most once
   * per reset cycle.
   */
  private maybeEmitWarning(): void {
    if (this.warningEmitted || this.onWarning == null) {
      return;
    }

    const status = this.checkBudget();

    if (status.isWarning) {
      this.warningEmitted = true;
      this.onWarning(
        `Token budget warning: ${status.usagePercent.toFixed(1)}% used ` +
        `($${status.totalCostUsd.toFixed(6)} / $${status.limitUsd.toFixed(6)})`,
        status,
      );
    }
  }
}
