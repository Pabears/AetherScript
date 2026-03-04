import type { PipelineConfig, PipelineResult, PipelineEvent } from './types.ts'
import type { AbstractScanner } from './scanner.ts'
import type { AbstractPromptSanitizer } from './prompt-sanitizer.ts'
import type { AbstractCodeGenerator } from './code-generator.ts'
import type { AbstractValidator } from './validator.ts'
import type { AbstractFileWriter } from './file-writer.ts'
import type { AbstractLLMClient } from './llm-client.ts'
import type { AbstractTokenTracker } from './token-tracker.ts'

export abstract class AbstractPipeline {
  constructor(
    protected readonly scanner: AbstractScanner,
    protected readonly sanitizer: AbstractPromptSanitizer,
    protected readonly generator: AbstractCodeGenerator,
    protected readonly validator: AbstractValidator,
    protected readonly writer: AbstractFileWriter,
    protected readonly llm: AbstractLLMClient,
    protected readonly tracker: AbstractTokenTracker,
  ) {}

  abstract run(config: PipelineConfig): Promise<PipelineResult>
  abstract onEvent(hook: (event: PipelineEvent) => void): void
}
