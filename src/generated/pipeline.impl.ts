// ============================================================
// AetherScript 2.0 — Pipeline Implementation (Final Fusion)
// Base: 优雅派 (TypedEventBus + Builder + timed() wrapper)
// Fused: 稳健派 rollback, config defense, DEFAULT_DANGEROUS_API_CONFIG, LLM ping
// Safety: No process.exitCode side-effects; hook errors → structured audit log
// ============================================================

import { AbstractPipeline } from '../abstracts/pipeline.ts';
import type { AbstractScanner } from '../abstracts/scanner.ts';
import type { AbstractPromptSanitizer } from '../abstracts/prompt-sanitizer.ts';
import type { AbstractCodeGenerator } from '../abstracts/code-generator.ts';
import type { AbstractValidator } from '../abstracts/validator.ts';
import type { AbstractFileWriter } from '../abstracts/file-writer.ts';
import type { AbstractLLMClient } from '../abstracts/llm-client.ts';
import type { AbstractTokenTracker } from '../abstracts/token-tracker.ts';
import type {
  PipelineConfig,
  PipelineResult,
  PipelineEvent,
  PipelineStage,
  DangerousApiConfig,
  CostReport,
  GeneratedFile,
  ValidationResult,
} from '../abstracts/types.ts';
import type { WriteOperation } from '../abstracts/file-writer.ts';
import type { SanitizedPayload, SanitizationReport } from '../abstracts/prompt-sanitizer.ts';
import type { ScanResult } from '../abstracts/types.ts';
import type { GenerationResult } from '../abstracts/code-generator.ts';

// ────────────────────────────────────────────────────────────
// Default dangerous API config (full list per verdict)
// ────────────────────────────────────────────────────────────

const DEFAULT_DANGEROUS_API_CONFIG: DangerousApiConfig = {
  bannedImports: [
    'child_process',
    'node:child_process',
    'fs',
    'node:fs',
    'fs/promises',
    'node:fs/promises',
    'os',
    'node:os',
    'net',
    'node:net',
    'http',
    'node:http',
    'https',
    'node:https',
    'crypto',
    'node:crypto',
  ],
  bannedGlobals: [
    'eval',
    'Function',
    'setTimeout',
  ],
};

// ────────────────────────────────────────────────────────────
// TypedEventBus — type-safe event dispatch with audit logging
// ────────────────────────────────────────────────────────────

interface AuditEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  detail?: unknown;
}

class TypedEventBus {
  private readonly hooks: Array<(event: PipelineEvent) => void> = [];
  private readonly _auditLog: AuditEntry[] = [];

  subscribe(hook: (event: PipelineEvent) => void): void {
    this.hooks.push(hook);
  }

  emit(event: PipelineEvent): void {
    for (const hook of this.hooks) {
      try {
        hook(event);
      } catch (err: unknown) {
        // Verdict: hook exceptions → structured audit log, never swallowed
        const message =
          err instanceof Error ? err.message : String(err);
        this._auditLog.push({
          timestamp: Date.now(),
          level: 'error',
          message: `Hook threw during stage="${event.stage}" status="${event.status}": ${message}`,
          detail: err instanceof Error ? { name: err.name, stack: err.stack } : err,
        });
      }
    }
  }

  get auditLog(): ReadonlyArray<AuditEntry> {
    return this._auditLog;
  }
}

// ────────────────────────────────────────────────────────────
// timed() — wraps an async stage function, emits start/success/failure events
// ────────────────────────────────────────────────────────────

async function timed<T>(
  bus: TypedEventBus,
  stage: PipelineStage,
  events: PipelineEvent[],
  fn: () => Promise<T>,
): Promise<T> {
  const startEvent: PipelineEvent = {
    stage,
    status: 'start',
    durationMs: 0,
  };
  bus.emit(startEvent);
  events.push(startEvent);

  const t0 = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - t0);
    const successEvent: PipelineEvent = {
      stage,
      status: 'success',
      durationMs,
    };
    bus.emit(successEvent);
    events.push(successEvent);
    return result;
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - t0);
    const failEvent: PipelineEvent = {
      stage,
      status: 'failure',
      durationMs,
      detail: err instanceof Error ? err.message : String(err),
    };
    bus.emit(failEvent);
    events.push(failEvent);
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// Helper: merge two ValidationResult objects
// ────────────────────────────────────────────────────────────

function mergeValidationResults(a: ValidationResult, b: ValidationResult): ValidationResult {
  return {
    passed: a.passed && b.passed,
    issues: [...a.issues, ...b.issues],
  };
}

// ────────────────────────────────────────────────────────────
// Helper: empty CostReport
// ────────────────────────────────────────────────────────────

function emptyCostReport(): CostReport {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    callCount: 0,
    breakdown: [],
  };
}

// ────────────────────────────────────────────────────────────
// Pipeline Implementation
// ────────────────────────────────────────────────────────────

export class PipelineImpl extends AbstractPipeline {
  private readonly bus: TypedEventBus = new TypedEventBus();

  constructor(
    scanner: AbstractScanner,
    sanitizer: AbstractPromptSanitizer,
    generator: AbstractCodeGenerator,
    validator: AbstractValidator,
    writer: AbstractFileWriter,
    llm: AbstractLLMClient,
    tracker: AbstractTokenTracker,
  ) {
    super(scanner, sanitizer, generator, validator, writer, llm, tracker);
  }

  // ── public API ──────────────────────────────────────────

  onEvent(hook: (event: PipelineEvent) => void): void {
    this.bus.subscribe(hook);
  }

  async run(config: PipelineConfig): Promise<PipelineResult> {
    // ── 1. Defensive config validation (稳健派 fusion) ──
    const cfgError = this.validateConfig(config);
    if (cfgError) {
      return this.failResult('scan', cfgError);
    }

    const dangerousApiConfig: DangerousApiConfig =
      config.dangerousApiConfig ?? DEFAULT_DANGEROUS_API_CONFIG;

    const events: PipelineEvent[] = [];

    // ── 2. LLM connectivity pre-check (稳健派 fusion) ──
    try {
      const alive = await this.llm.ping();
      if (!alive) {
        return this.failResult('scan', 'LLM connectivity pre-check failed: ping returned false', events);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.failResult('scan', `LLM connectivity pre-check failed: ${msg}`, events);
    }

    // ── 3. Execute pipeline stages ──
    let scanResult: ScanResult;
    let sanitizeResult: { payload: SanitizedPayload; report: SanitizationReport };
    let generationResult: GenerationResult;
    let validationResult: ValidationResult;
    let filesWritten: string[] = [];

    // ── SCAN ──
    try {
      scanResult = await timed(this.bus, 'scan', events, () =>
        this.scanner.scan(config.projectDir),
      );
    } catch (err: unknown) {
      return this.failResult('scan', this.extractError(err), events);
    }

    if (scanResult.classes.length === 0) {
      // Nothing to process — success with no files
      return {
        success: true,
        stage: 'scan',
        filesWritten: [],
        usage: this.safeGetReport(),
        events,
      };
    }

    // ── SANITIZE ──
    try {
      sanitizeResult = await timed(this.bus, 'sanitize', events, () =>
        this.sanitizer.sanitize(scanResult),
      );
    } catch (err: unknown) {
      return this.failResult('sanitize', this.extractError(err), events);
    }

    if (sanitizeResult.report.riskLevel === 'hostile') {
      return this.failResult(
        'sanitize',
        `Sanitizer flagged hostile input: ${sanitizeResult.report.warnings.join('; ')}`,
        events,
      );
    }

    // ── GENERATE ──
    try {
      generationResult = await timed(this.bus, 'generate', events, () =>
        this.generator.generate(sanitizeResult.payload),
      );
    } catch (err: unknown) {
      return this.failResult('generate', this.extractError(err), events);
    }

    // Record token usage
    try {
      this.tracker.record(
        `pipeline-gen-${Date.now()}`,
        'code-generation',
        generationResult.usage,
      );
    } catch {
      // Tracker record failure is non-fatal; pipeline continues
    }

    if (generationResult.files.length === 0) {
      return this.failResult('generate', 'Code generator returned zero files', events);
    }

    // ── VALIDATE ──
    try {
      validationResult = await timed(this.bus, 'validate', events, () =>
        this.validator.validateAll(
          generationResult.files,
          scanResult.classes,
          config.projectDir,
          dangerousApiConfig,
        ),
      );
    } catch (err: unknown) {
      return this.failResult('validate', this.extractError(err), events);
    }

    if (!validationResult.passed) {
      const errorSummary = validationResult.issues
        .filter((i) => i.severity === 'error')
        .map((i) => `[${i.code}] ${i.message} (${i.file}${i.line != null ? `:${i.line}` : ''})`)
        .join('\n');
      return this.failResult(
        'validate',
        `Validation failed:\n${errorSummary}`,
        events,
      );
    }

    // ── WRITE ──
    try {
      const writeOp: WriteOperation = {
        files: generationResult.files,
        projectRoot: config.projectDir,
      };
      const writeResult = await timed(this.bus, 'write', events, () =>
        this.writer.write(writeOp, config.dryRun),
      );
      filesWritten = writeResult.writtenFiles;
    } catch (err: unknown) {
      // Verdict (稳健派 fusion): rollback on write failure
      try {
        await this.writer.rollback();
      } catch (rollbackErr: unknown) {
        // Record rollback failure in audit log via a synthetic event
        const rollbackMsg =
          rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
        this.bus.emit({
          stage: 'write',
          status: 'failure',
          durationMs: 0,
          detail: `Rollback also failed: ${rollbackMsg}`,
        });
      }
      return this.failResult('write', this.extractError(err), events);
    }

    // ── SUCCESS ──
    return {
      success: true,
      stage: 'write',
      filesWritten,
      usage: this.safeGetReport(),
      events,
    };
  }

  // ── private helpers ────────────────────────────────────

  /**
   * Defensive config validation (稳健派 fusion).
   * Returns an error string if config is invalid, or null if OK.
   */
  private validateConfig(config: PipelineConfig): string | null {
    if (config == null) {
      return 'PipelineConfig is null or undefined';
    }
    if (typeof config !== 'object') {
      return `PipelineConfig must be an object, got ${typeof config}`;
    }
    if (!config.projectDir || typeof config.projectDir !== 'string') {
      return 'PipelineConfig.projectDir must be a non-empty string';
    }
    if (config.projectDir.trim().length === 0) {
      return 'PipelineConfig.projectDir must be a non-empty string';
    }
    if (
      config.maxCostPerRunUsd !== undefined &&
      (typeof config.maxCostPerRunUsd !== 'number' || config.maxCostPerRunUsd < 0 || !Number.isFinite(config.maxCostPerRunUsd))
    ) {
      return 'PipelineConfig.maxCostPerRunUsd must be a non-negative finite number';
    }
    if (config.dryRun !== undefined && typeof config.dryRun !== 'boolean') {
      return 'PipelineConfig.dryRun must be a boolean';
    }
    if (config.dangerousApiConfig !== undefined) {
      if (config.dangerousApiConfig == null || typeof config.dangerousApiConfig !== 'object') {
        return 'PipelineConfig.dangerousApiConfig must be an object when provided';
      }
      if (!Array.isArray(config.dangerousApiConfig.bannedImports)) {
        return 'dangerousApiConfig.bannedImports must be an array';
      }
      if (!Array.isArray(config.dangerousApiConfig.bannedGlobals)) {
        return 'dangerousApiConfig.bannedGlobals must be an array';
      }
    }
    return null;
  }

  /**
   * Build a failure PipelineResult.
   * Verdict: never sets process.exitCode — report errors in PipelineResult.error.
   */
  private failResult(
    stage: PipelineStage,
    error: string,
    events: PipelineEvent[] = [],
  ): PipelineResult {
    return {
      success: false,
      stage,
      filesWritten: [],
      usage: this.safeGetReport(),
      events,
      error,
    };
  }

  /** Safely get the cost report; returns empty report on tracker error. */
  private safeGetReport(): CostReport {
    try {
      return this.tracker.getReport();
    } catch {
      return emptyCostReport();
    }
  }

  /** Extract a human-readable message from an unknown thrown value. */
  private extractError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }
}
