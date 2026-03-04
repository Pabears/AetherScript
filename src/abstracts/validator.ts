import type { GeneratedFile, ScannedClass, ValidationResult, DangerousApiConfig } from './types.ts'

export abstract class AbstractValidator {
  abstract verifyContract(generated: GeneratedFile[], scanned: ScannedClass[]): Promise<ValidationResult>
  abstract scanDangerousApis(files: GeneratedFile[], config: DangerousApiConfig): Promise<ValidationResult>
  abstract checkCompilation(files: GeneratedFile[], projectRoot: string): Promise<ValidationResult>
  abstract validateAll(
    generated: GeneratedFile[],
    scanned: ScannedClass[],
    projectRoot: string,
    dangerousApiConfig: DangerousApiConfig
  ): Promise<ValidationResult>
}
