import type { TokenUsage } from './types.ts'

export interface LLMRequest<TOutput> {
  systemPrompt: string
  userPrompt: string
  outputSchema: Record<string, unknown>
  temperature?: number
  maxTokens?: number
}

export interface LLMResponse<TOutput> {
  data: TOutput
  usage: TokenUsage
  requestId: string
}

export abstract class AbstractLLMClient {
  abstract request<TOutput>(req: LLMRequest<TOutput>): Promise<LLMResponse<TOutput>>
  abstract ping(): Promise<boolean>
}
