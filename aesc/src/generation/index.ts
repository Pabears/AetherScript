/**
 * Generation module - unified entry point for code generation functionality
 */

// Re-export all generation functionality
export * from './code-cleaner'
export * from './code-fixer'
export * from './post-processor'

// Import for convenience
import { cleanGeneratedCode } from './code-cleaner'
import { fixGeneratedCode } from './code-fixer'
import {
  postProcessGeneratedCode,
  validateGeneratedCode,
} from './post-processor'

/**
 * High-level code generation pipeline
 */
export class CodeGenerationPipeline {
  /**
   * Process raw AI-generated code through the complete pipeline
   */
  async processGeneratedCode(
    rawCode: string,
    declaration: InterfaceDeclaration | ClassDeclaration,
    implFilePath: string,
    originalImportPath: string,
    interfaceName: string,
    model: string,
    verbose: boolean = false,
    provider?: string,
  ): Promise<{
    success: boolean
    processedCode?: string
    errors?: string[]
    attempts?: number
  }> {
    try {
      // Step 1: Clean the raw generated code
      const cleanedCode = cleanGeneratedCode(rawCode, interfaceName, verbose)

      // Step 2: Post-process the cleaned code
      let processedCode = postProcessGeneratedCode(
        cleanedCode,
        declaration,
        implFilePath,
      )

      if (verbose) {
        console.log('--- CODE AFTER POST-PROCESSING ---')
        console.log(processedCode)
        console.log('--------------------------------')
      }

      // Step 3: Validate the processed code
      const { isValid, errors } = await validateGeneratedCode(
        processedCode,
        declaration,
        implFilePath,
      )

      // Step 4: If validation fails, try to fix the code
      if (!isValid) {
        const fixResult = await fixGeneratedCode(
          processedCode,
          declaration,
          implFilePath,
          originalImportPath,
          interfaceName,
          errors,
          model,
          verbose,
          provider,
        )

        if (fixResult.success && fixResult.fixedCode) {
          processedCode = fixResult.fixedCode
          return {
            success: true,
            processedCode,
            attempts: fixResult.attempts,
          }
        } else {
          return {
            success: false,
            errors,
            attempts: fixResult.attempts,
          }
        }
      }

      return {
        success: true,
        processedCode,
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }
}
