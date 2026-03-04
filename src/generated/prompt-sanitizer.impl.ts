// ============================================================
// AetherScript 2.0 — PromptSanitizer Implementation
// Chain of Responsibility architecture with extensible rules
// ============================================================

import type { ScanResult, ScannedClass } from '../abstracts/types.ts';
import {
  AbstractPromptSanitizer,
  SANITIZED_SYMBOL,
  type SanitizedPayload,
  type SanitizationReport,
} from '../abstracts/prompt-sanitizer.ts';

// ---------------------------------------------------------------------------
// SanitizationRule interface
// ---------------------------------------------------------------------------

export interface SanitizationRule {
  /** Unique name used in [REDACTED: <name>] markers and reports */
  readonly name: string;
  /** Apply the rule to a single text field. Return the (possibly modified) text. */
  apply(text: string, warnings: string[]): string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SOURCE_LENGTH = 8000;

// ---------------------------------------------------------------------------
// Built-in rules (order matters — executed sequentially)
// ---------------------------------------------------------------------------

/** 1. NFKC normalisation — collapse exotic Unicode forms first */
class NfkcNormalizationRule implements SanitizationRule {
  readonly name = 'NfkcNormalization';
  apply(text: string, _warnings: string[]): string {
    return text.normalize('NFKC');
  }
}

/** 2. Length truncation */
class LengthTruncationRule implements SanitizationRule {
  readonly name = 'LengthTruncation';
  apply(text: string, warnings: string[]): string {
    if (text.length > MAX_SOURCE_LENGTH) {
      warnings.push(`${this.name}: truncated from ${text.length} to ${MAX_SOURCE_LENGTH} chars`);
      return text.slice(0, MAX_SOURCE_LENGTH);
    }
    return text;
  }
}

/** 3. Instruction override detection */
class InstructionOverrideRule implements SanitizationRule {
  readonly name = 'InstructionOverride';
  private readonly pattern = /\b(ignore\s+(all\s+)?previous\s+(instructions?|prompts?|context)|disregard\s+(all\s+)?(above|previous|prior)|forget\s+(everything|all|previous)|new\s+instruction[s]?|override\s+(system|instruction|prompt)|do\s+not\s+follow\s+(previous|above|prior))\b/gi;
  apply(text: string, warnings: string[]): string {
    if (this.pattern.test(text)) {
      this.pattern.lastIndex = 0; // reset stateful regex
      warnings.push(`${this.name}: instruction override attempt detected`);
      return text.replace(this.pattern, `[REDACTED: ${this.name}]`);
    }
    this.pattern.lastIndex = 0;
    return text;
  }
}

/** 4. System prompt escape */
class SystemPromptEscapeRule implements SanitizationRule {
  readonly name = 'SystemPromptEscape';
  private readonly pattern = /<\/?system>|\[\/?(SYSTEM|system)\]|<\|system\|>|###\s*system\s*###/gi;
  apply(text: string, warnings: string[]): string {
    if (this.pattern.test(text)) {
      this.pattern.lastIndex = 0;
      warnings.push(`${this.name}: system prompt escape markers detected`);
      return text.replace(this.pattern, `[REDACTED: ${this.name}]`);
    }
    this.pattern.lastIndex = 0;
    return text;
  }
}

/** 5. Chat template injection */
class ChatTemplateInjectionRule implements SanitizationRule {
  readonly name = 'ChatTemplateInjection';
  private readonly pattern = /\[\/?(INST|inst)\]|<\|im_(start|end)\|>|<<\/?SYS>>|<\|user\|>|<\|assistant\|>|<\|endoftext\|>|<\|pad\|>/gi;
  apply(text: string, warnings: string[]): string {
    if (this.pattern.test(text)) {
      this.pattern.lastIndex = 0;
      warnings.push(`${this.name}: chat template tokens detected`);
      return text.replace(this.pattern, `[REDACTED: ${this.name}]`);
    }
    this.pattern.lastIndex = 0;
    return text;
  }
}

/** 6. XML tag injection */
class XmlTagInjectionRule implements SanitizationRule {
  readonly name = 'XmlTagInjection';
  private readonly pattern = /<\/?(prompt|context|instruction|message|input|output|response|tool_call|function_call|tool_result|function_result)\s*\/?>/gi;
  apply(text: string, warnings: string[]): string {
    if (this.pattern.test(text)) {
      this.pattern.lastIndex = 0;
      warnings.push(`${this.name}: suspicious XML tags detected`);
      return text.replace(this.pattern, `[REDACTED: ${this.name}]`);
    }
    this.pattern.lastIndex = 0;
    return text;
  }
}

/** 7. Token stuffing — repeated chars & zero-width characters */
class TokenStuffingRule implements SanitizationRule {
  readonly name = 'TokenStuffing';
  // Zero-width chars: U+200B–U+200F, U+FEFF
  private readonly zeroWidthPattern = /[\u200B-\u200F\uFEFF]+/g;
  // Repeated non-whitespace character ≥ 30 times (tuned to avoid false positives)
  private readonly repeatPattern = /(.)\1{29,}/g;

  apply(text: string, warnings: string[]): string {
    let result = text;
    let flagged = false;

    if (this.zeroWidthPattern.test(result)) {
      this.zeroWidthPattern.lastIndex = 0;
      flagged = true;
      result = result.replace(this.zeroWidthPattern, '');
    }

    if (this.repeatPattern.test(result)) {
      this.repeatPattern.lastIndex = 0;
      flagged = true;
      result = result.replace(this.repeatPattern, `[REDACTED: ${this.name}]`);
    }

    if (flagged) {
      warnings.push(`${this.name}: token stuffing / zero-width characters detected`);
    }

    return result;
  }
}

/** 8. Base64 encoded bypass detection */
class Base64BypassRule implements SanitizationRule {
  readonly name = 'Base64Bypass';
  // Match long base64-looking blocks (≥40 chars, in a contiguous block)
  private readonly base64Pattern = /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])/g;

  apply(text: string, warnings: string[]): string {
    let result = text;
    let flagged = false;

    result = result.replace(this.base64Pattern, (match) => {
      try {
        // Attempt to decode; if it produces readable ASCII with suspicious keywords → redact
        const decoded = Buffer.from(match, 'base64').toString('utf-8');
        const suspiciousKeywords = /ignore|disregard|system|instruction|override|<\||\[INST\]/i;
        if (suspiciousKeywords.test(decoded)) {
          flagged = true;
          return `[REDACTED: ${this.name}]`;
        }
      } catch {
        // Not valid base64 — leave as is
      }
      return match;
    });

    if (flagged) {
      warnings.push(`${this.name}: base64-encoded injection payload detected`);
    }

    return result;
  }
}

/** 9. XML entity escaping — terminal sanitisation */
class XmlEscapeRule implements SanitizationRule {
  readonly name = 'XmlEscape';
  apply(text: string, _warnings: string[]): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// ---------------------------------------------------------------------------
// Default built-in rule chain
// ---------------------------------------------------------------------------

function createDefaultRules(): SanitizationRule[] {
  return [
    new NfkcNormalizationRule(),
    new LengthTruncationRule(),
    new InstructionOverrideRule(),
    new SystemPromptEscapeRule(),
    new ChatTemplateInjectionRule(),
    new XmlTagInjectionRule(),
    new TokenStuffingRule(),
    new Base64BypassRule(),
    new XmlEscapeRule(),
  ];
}

// ---------------------------------------------------------------------------
// PromptSanitizer implementation
// ---------------------------------------------------------------------------

export class PromptSanitizerImpl extends AbstractPromptSanitizer {
  private readonly rules: SanitizationRule[];

  constructor(rules?: SanitizationRule[]) {
    super();
    this.rules = rules ?? createDefaultRules();
  }

  /** Return a new sanitizer with an additional rule appended to the chain. */
  withRule(rule: SanitizationRule): PromptSanitizerImpl {
    return new PromptSanitizerImpl([...this.rules, rule]);
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  async sanitize(
    scanResult: ScanResult,
  ): Promise<{ payload: SanitizedPayload; report: SanitizationReport }> {
    const allWarnings: string[] = [];
    const sanitizedClasses: Array<{
      className: string;
      sanitizedSource: string;
      methodSignatures: string[];
      typeContext: string;
    }> = [];

    for (const cls of scanResult.classes) {
      try {
        const classWarnings: string[] = [];

        const sanitizedSource = this.applyChain(cls.sourceText, classWarnings);
        const sanitizedTypeContext = this.applyChain(cls.typeContext, classWarnings);
        const sanitizedSignatures = cls.methodSignatures.map((sig) =>
          this.applyChain(sig, classWarnings),
        );

        allWarnings.push(...classWarnings);

        sanitizedClasses.push({
          className: cls.className,
          sanitizedSource,
          methodSignatures: sanitizedSignatures,
          typeContext: sanitizedTypeContext,
        });
      } catch (err: unknown) {
        // Per-class try-catch: single class failure must not break others
        const message = err instanceof Error ? err.message : String(err);
        allWarnings.push(`[FATAL] Failed to sanitize class ${cls.className}: ${message}`);
        // Push a safe empty entry so downstream consumers still see the class
        sanitizedClasses.push({
          className: cls.className,
          sanitizedSource: '',
          methodSignatures: [],
          typeContext: '',
        });
      }
    }

    const riskLevel = this.computeRiskLevel(allWarnings);

    const payload: SanitizedPayload = Object.freeze({
      [SANITIZED_SYMBOL]: true as const,
      classes: Object.freeze(sanitizedClasses.map((c) => Object.freeze(c))),
      sanitizedAt: Date.now(),
    });

    const report: SanitizationReport = {
      strippedCount: allWarnings.length,
      riskLevel,
      warnings: allWarnings,
    };

    return { payload, report };
  }

  detectInjectionPatterns(source: string): string[] {
    const warnings: string[] = [];
    // Run all rules except NFKC-normalize and XmlEscape (which are not detectors)
    const detectionRules = this.rules.filter(
      (r) => r.name !== 'NfkcNormalization' && r.name !== 'XmlEscape',
    );
    for (const rule of detectionRules) {
      try {
        rule.apply(source, warnings);
      } catch {
        // swallow — detection is best-effort
      }
    }
    return warnings;
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private applyChain(text: string, warnings: string[]): string {
    let current = text;
    for (const rule of this.rules) {
      current = rule.apply(current, warnings);
    }
    return current;
  }

  private computeRiskLevel(warnings: string[]): 'clean' | 'suspicious' | 'hostile' {
    // Only count security-relevant warnings (exclude pure truncation / normalization)
    const securityWarnings = warnings.filter(
      (w) =>
        !w.startsWith('NfkcNormalization:') &&
        !w.startsWith('LengthTruncation:') &&
        !w.startsWith('XmlEscape:') &&
        !w.startsWith('[FATAL]'),
    );
    const count = securityWarnings.length;
    if (count === 0) return 'clean';
    if (count <= 2) return 'suspicious';
    return 'hostile';
  }
}
