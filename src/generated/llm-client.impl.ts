// ============================================================
// AetherScript 2.0 — LLMClient Implementation
// Architecture: Strategy pattern with ProviderStrategy interface
// Providers: AnthropicStrategy (production), MockStrategy (testing)
// Verdict: 2026-03-04
// ============================================================

import type { TokenUsage } from '../abstracts/types.ts';
import {
  AbstractLLMClient,
  type LLMRequest,
  type LLMResponse,
} from '../abstracts/llm-client.ts';
import Anthropic from '@anthropic-ai/sdk';

// ─── Error Types ─────────────────────────────────────────────

/**
 * Thrown when the LLM provider returns a retryable error
 * and all retry attempts have been exhausted.
 */
export class LLMRetryExhaustedError extends Error {
  public readonly attempts: number;
  public readonly lastStatusCode: number | undefined;

  constructor(attempts: number, lastStatusCode: number | undefined, cause?: Error) {
    const msg = `LLM request failed after ${attempts} attempts` +
      (lastStatusCode ? ` (last status: ${lastStatusCode})` : '');
    super(msg, { cause });
    this.name = 'LLMRetryExhaustedError';
    this.attempts = attempts;
    this.lastStatusCode = lastStatusCode;
  }
}

/**
 * Thrown when the LLM request times out.
 */
export class LLMTimeoutError extends Error {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`);
    this.name = 'LLMTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when the provider configuration is invalid.
 */
export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMConfigError';
  }
}

// ─── Strategy Interface ──────────────────────────────────────

export interface ProviderStrategy {
  /** Send a structured request and get a typed response. */
  request<TOutput>(req: LLMRequest<TOutput>): Promise<LLMResponse<TOutput>>;

  /** Lightweight connectivity check. */
  ping(): Promise<boolean>;

  /** Human-readable model identifier for logging. */
  getModel(): string;
}

// ─── Retry Helpers ───────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const REQUEST_TIMEOUT_MS = 60_000;

function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return RETRYABLE_STATUS_CODES.has(err.status);
  }
  return false;
}

function getStatusCode(err: unknown): number | undefined {
  if (err instanceof Anthropic.APIError) {
    return err.status;
  }
  return undefined;
}

/**
 * Strips any potential API key from error messages to prevent
 * accidental leakage in logs.
 */
function sanitizeErrorMessage(msg: string, apiKey: string): string {
  if (!apiKey) return msg;
  // Replace full key and any partial key (first 10+ chars) occurrences
  let sanitized = msg.replaceAll(apiKey, '[REDACTED]');
  if (apiKey.length >= 10) {
    const partialKey = apiKey.slice(0, 10);
    sanitized = sanitized.replaceAll(partialKey, '[REDACTED…]');
  }
  return sanitized;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Anthropic Strategy ──────────────────────────────────────

/**
 * Production strategy using the official Anthropic SDK.
 * Uses `tool_use` mode for structured JSON output (no regex parsing).
 * Includes exponential backoff retry for transient errors.
 */
export class AnthropicStrategy implements ProviderStrategy {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new LLMConfigError(
        'Anthropic API key must be provided and non-empty. ' +
        'Set ANTHROPIC_API_KEY environment variable or pass explicitly.',
      );
    }
    this.apiKey = apiKey.trim();
    this.model = model ?? 'claude-sonnet-4-20250514';
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  getModel(): string {
    return this.model;
  }

  async request<TOutput>(req: LLMRequest<TOutput>): Promise<LLMResponse<TOutput>> {
    // Build the tool definition from the output schema.
    // This forces the model to respond with structured JSON via tool_use.
    const toolName = 'structured_output';
    const tool: Anthropic.Tool = {
      name: toolName,
      description: 'Return the structured output matching the requested schema.',
      input_schema: req.outputSchema as Anthropic.Tool['input_schema'],
    };

    let lastError: Error | undefined;
    let lastStatusCode: number | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await this.client.messages.create(
          {
            model: this.model,
            max_tokens: req.maxTokens ?? 4096,
            temperature: req.temperature ?? 0,
            system: req.systemPrompt,
            messages: [
              { role: 'user', content: req.userPrompt },
            ],
            tools: [tool],
            tool_choice: { type: 'tool', name: toolName },
          },
          { signal: controller.signal },
        );

        clearTimeout(timer);

        // Extract the tool_use block from the response
        const toolBlock = response.content.find(
          (block): block is Anthropic.ContentBlock & { type: 'tool_use' } =>
            block.type === 'tool_use' && block.name === toolName,
        );

        if (!toolBlock) {
          throw new Error(
            `Model did not return a tool_use block for '${toolName}'. ` +
            `Got content types: [${response.content.map((b) => b.type).join(', ')}]`,
          );
        }

        const data = toolBlock.input as TOutput;

        const usage: TokenUsage = {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          estimatedCostUsd: this.estimateCost(
            response.usage.input_tokens,
            response.usage.output_tokens,
          ),
        };

        return {
          data,
          usage,
          requestId: response.id,
        };
      } catch (err: unknown) {
        clearTimeout(timer);

        // Handle abort (timeout)
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new LLMTimeoutError(REQUEST_TIMEOUT_MS);
        }

        // Sanitize error to prevent API key leakage
        if (err instanceof Error) {
          err.message = sanitizeErrorMessage(err.message, this.apiKey);
        }

        lastStatusCode = getStatusCode(err);
        lastError = err instanceof Error ? err : new Error(String(err));

        // Only retry retryable errors
        if (isRetryableError(err) && attempt < MAX_RETRIES) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await sleep(delayMs);
          continue;
        }

        // Non-retryable error or last attempt — bail out
        break;
      }
    }

    throw new LLMRetryExhaustedError(MAX_RETRIES, lastStatusCode, lastError);
  }

  async ping(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);
      return response.id !== undefined;
    } catch (err: unknown) {
      clearTimeout(timer);
      // Sanitize before any potential logging
      if (err instanceof Error) {
        err.message = sanitizeErrorMessage(err.message, this.apiKey);
      }
      return false;
    }
  }

  /**
   * Rough cost estimation based on Claude Sonnet 4 pricing.
   * Input: $3/MTok, Output: $15/MTok (as of 2025).
   * Override with accurate rates as pricing changes.
   */
  private estimateCost(inputTokens: number, outputTokens: number): number {
    const inputCostPerToken = 3.0 / 1_000_000;
    const outputCostPerToken = 15.0 / 1_000_000;
    return inputTokens * inputCostPerToken + outputTokens * outputCostPerToken;
  }
}

// ─── Mock Strategy ───────────────────────────────────────────

/**
 * Testing strategy that returns pre-configured fixture responses.
 * No network requests are made.
 */
export class MockStrategy implements ProviderStrategy {
  private readonly fixtureResponse: LLMResponse<unknown>;
  private readonly modelName: string;

  constructor(fixtureResponse: LLMResponse<unknown>, modelName?: string) {
    this.fixtureResponse = fixtureResponse;
    this.modelName = modelName ?? 'mock-model';
  }

  getModel(): string {
    return this.modelName;
  }

  async request<TOutput>(_req: LLMRequest<TOutput>): Promise<LLMResponse<TOutput>> {
    return this.fixtureResponse as LLMResponse<TOutput>;
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

// ─── LLMClientImpl ───────────────────────────────────────────

/**
 * Concrete LLMClient implementation using the Strategy pattern.
 *
 * Provider selection is driven by the `AESC_PROVIDER` environment variable:
 *   - `anthropic` (default): Uses AnthropicStrategy with ANTHROPIC_API_KEY
 *   - `mock`: Requires a MockStrategy to be injected via `setStrategy()`
 *
 * For testing, use `LLMClientImpl.withStrategy(strategy)` factory.
 */
export class LLMClientImpl extends AbstractLLMClient {
  private strategy: ProviderStrategy;

  /**
   * Construct with auto-detected provider from environment.
   * Use the static factories for explicit control.
   */
  constructor(strategy?: ProviderStrategy) {
    super();
    this.strategy = strategy ?? LLMClientImpl.createDefaultStrategy();
  }

  // ── Static Factories ────────────────────────────────────────

  /** Create an instance with a specific strategy (e.g. for testing). */
  static withStrategy(strategy: ProviderStrategy): LLMClientImpl {
    return new LLMClientImpl(strategy);
  }

  /** Create an instance with the Anthropic provider. */
  static withAnthropic(apiKey: string, model?: string): LLMClientImpl {
    return new LLMClientImpl(new AnthropicStrategy(apiKey, model));
  }

  /** Create an instance with a mock fixture for testing. */
  static withMock(fixtureResponse: LLMResponse<unknown>): LLMClientImpl {
    return new LLMClientImpl(new MockStrategy(fixtureResponse));
  }

  // ── AbstractLLMClient Implementation ────────────────────────

  async request<TOutput>(req: LLMRequest<TOutput>): Promise<LLMResponse<TOutput>> {
    return this.strategy.request(req);
  }

  async ping(): Promise<boolean> {
    return this.strategy.ping();
  }

  /** Returns the model identifier from the active strategy. */
  getModel(): string {
    return this.strategy.getModel();
  }

  /** Replace the active strategy at runtime. */
  setStrategy(strategy: ProviderStrategy): void {
    this.strategy = strategy;
  }

  /** Get a reference to the active strategy (useful for testing). */
  getStrategy(): ProviderStrategy {
    return this.strategy;
  }

  // ── Private ─────────────────────────────────────────────────

  /**
   * Auto-detect provider from AESC_PROVIDER env var.
   * Defaults to Anthropic if not set.
   */
  private static createDefaultStrategy(): ProviderStrategy {
    const provider = (process.env.AESC_PROVIDER ?? 'anthropic').toLowerCase();

    switch (provider) {
      case 'anthropic': {
        const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
        const model = process.env.AESC_MODEL ?? undefined;
        return new AnthropicStrategy(apiKey, model);
      }
      case 'mock':
        throw new LLMConfigError(
          'Mock provider requires explicit fixture injection. ' +
          'Use LLMClientImpl.withMock(fixture) or LLMClientImpl.withStrategy(strategy).',
        );
      default:
        throw new LLMConfigError(
          `Unknown LLM provider: '${provider}'. ` +
          `Supported values for AESC_PROVIDER: anthropic, mock`,
        );
    }
  }
}
