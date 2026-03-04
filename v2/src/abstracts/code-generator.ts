// @autogen
import type { GeneratedFile, GenerationResult, TokenUsage } from './types.ts'
import type { SanitizedPayload } from './prompt-sanitizer.ts'
import type { AbstractLLMClient } from './llm-client.ts'

export interface GenerationResult {
  files: GeneratedFile[]
  usage: TokenUsage
}

// @autogen
export abstract class AbstractCodeGenerator {
  constructor(protected readonly llm: AbstractLLMClient) {}
  abstract generate(payload: SanitizedPayload): Promise<GenerationResult>
}
