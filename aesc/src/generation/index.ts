import { InterfaceDeclaration, ClassDeclaration } from 'ts-morph'
import { generatePrompt } from '../prompt-generator'
import { callOllamaModel } from '../model-caller'
import { cleanGeneratedCode } from './code-cleaner'
import {
  postProcessGeneratedCode,
  validateGeneratedCode,
} from './post-processor'

/**
 * Generate implementation for a single interface
 */
export async function generateImplementation(
  declaration: InterfaceDeclaration | ClassDeclaration,
  originalImportPath: string,
  implFilePath: string,
  model: string,
  verbose: boolean = false,
  provider?: string,
): Promise<string> {
  const interfaceName = declaration.getName()!

  const prompt = generatePrompt(
    declaration,
    originalImportPath,
    implFilePath,
  )

  const rawResponse = await callOllamaModel(
    prompt,
    interfaceName,
    model,
    verbose,
    provider,
  )
  const cleanedCode = cleanGeneratedCode(rawResponse, interfaceName, verbose)
  const finalCode = postProcessGeneratedCode(
    cleanedCode,
    declaration,
    implFilePath,
  )

  const validationResult = await validateGeneratedCode(
    finalCode,
    declaration,
    implFilePath,
  )
  if (!validationResult.isValid) {
    throw new Error(
      `Generated code for ${interfaceName} is invalid:\n${validationResult.errors.join('\n')}`,
    )
  }

  return finalCode
}
