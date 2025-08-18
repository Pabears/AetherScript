import { ClassDeclaration, InterfaceDeclaration } from 'ts-morph'
import { callOllamaModel } from '../model-caller'
import { cleanGeneratedCode } from './code-cleaner'
import {
  postProcessGeneratedCode,
  validateGeneratedCode,
} from './post-processor'
import { generatePrompt, generateFixPrompt } from '../prompt-generator'

export interface CodeFixResult {
  success: boolean
  fixedCode?: string
  attempts: number
  errors?: string[]
}

/**
 * Attempts to fix validation errors in generated code using the same model and provider as generation
 */
export async function fixGeneratedCode(
  originalCode: string,
  declaration: ClassDeclaration | InterfaceDeclaration,
  implFilePath: string,
  originalImportPath: string,
  interfaceName: string,
  validationErrors: string[],
  model: string,
  verbose: boolean,
  provider?: string,
  maxRetries: number = 3,
): Promise<CodeFixResult> {
  if (verbose) {
    console.log(
      `  -> WARNING: Generated code for ${interfaceName} failed validation. Attempting to fix with ${provider || 'ollama'}...`,
    )
    validationErrors.forEach((err) => console.log(`    - ${err}`))
  }

  let retryCount = 0
  let currentCode = originalCode
  let isValid = false
  let errors = validationErrors

  while (!isValid && retryCount < maxRetries) {
    retryCount++
    if (verbose) {
      console.log(
        `  -> Retry attempt ${retryCount}/${maxRetries} for ${interfaceName}...`,
      )
    }

    try {
      // Use the dedicated generateFixPrompt function instead of regex extraction
      const fixPrompt = generateFixPrompt(
        declaration,
        originalImportPath,
        implFilePath,
        currentCode,
        errors,
        provider,
      )

      // Use the same model and provider as the original generation
      const fixedResponse = await callOllamaModel(
        fixPrompt,
        `${interfaceName}-fix-${retryCount}`,
        model,
        verbose,
        provider,
      )
      const fixedCode = cleanGeneratedCode(
        fixedResponse,
        interfaceName,
        verbose,
      )
      const fixedProcessedCode = postProcessGeneratedCode(
        fixedCode,
        declaration,
        implFilePath,
      )

      // Validate the fixed code
      const validationResult = await validateGeneratedCode(
        fixedProcessedCode,
        declaration,
        implFilePath,
      )
      isValid = validationResult.isValid
      errors = validationResult.errors

      if (isValid) {
        if (verbose) {
          console.log(`  -> SUCCESS: Code fixed on attempt ${retryCount}`)
        }
        return {
          success: true,
          fixedCode: fixedProcessedCode,
          attempts: retryCount,
        }
      } else {
        if (verbose) {
          console.log(`  -> Attempt ${retryCount} failed. Errors:`)
          errors.forEach((err) => console.log(`    - ${err}`))
        }
        currentCode = fixedProcessedCode // Use the latest attempt for next retry
      }
    } catch (error) {
      if (verbose) {
        console.error(`  -> Error during retry attempt ${retryCount}: ${error}`)
      }
    }
  }

  // If still not valid after all retries
  if (verbose) {
    console.error(
      `  -> ERROR: Generated code for ${interfaceName} failed validation after ${maxRetries} retry attempts.`,
    )
    if (verbose) {
      console.log('--- FINAL FAILED CODE --- ')
      console.log(currentCode)
      console.log('-------------------------')
    }
  }

  return {
    success: false,
    attempts: retryCount,
    errors: errors,
  }
}
