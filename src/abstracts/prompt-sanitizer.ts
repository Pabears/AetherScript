import type { ScanResult } from './types.ts'

export const SANITIZED_SYMBOL = Symbol('SanitizedPayload')

export interface SanitizedPayload {
  readonly [SANITIZED_SYMBOL]: true
  readonly classes: ReadonlyArray<{
    className: string
    sanitizedSource: string
    methodSignatures: string[]
    typeContext: string
  }>
  readonly sanitizedAt: number
}

export interface SanitizationReport {
  strippedCount: number
  riskLevel: 'clean' | 'suspicious' | 'hostile'
  warnings: string[]
}

export abstract class AbstractPromptSanitizer {
  abstract sanitize(scanResult: ScanResult): Promise<{ payload: SanitizedPayload; report: SanitizationReport }>
  abstract detectInjectionPatterns(source: string): string[]

  static verify(payload: unknown): payload is SanitizedPayload {
    return typeof payload === 'object' && payload !== null &&
      (payload as any)[SANITIZED_SYMBOL] === true
  }
}
