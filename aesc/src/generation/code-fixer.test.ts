import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test'
import { fixGeneratedCode } from './code-fixer'
import * as modelCaller from '../model-caller'
import * as codeCleaner from './code-cleaner'
import * as postProcessor from './post-processor'
import * as promptGenerator from './prompt-generator'
import { Project, InterfaceDeclaration } from 'ts-morph'

describe('fixGeneratedCode', () => {
  let project: Project
  let declaration: InterfaceDeclaration

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true })
    const sourceFile = project.createSourceFile(
      'test.ts',
      'export interface ITest {}',
    )
    declaration = sourceFile.getInterfaceOrThrow('ITest')

    // Mock dependencies
    spyOn(modelCaller, 'callOllamaModel').mockResolvedValue('fixed code response')
    spyOn(postProcessor, 'validateGeneratedCode').mockResolvedValue({ isValid: true, errors: [] })
    spyOn(promptGenerator, 'generateFixPrompt').mockReturnValue('fix prompt')
  })

  afterEach(() => {
    (modelCaller.callOllamaModel as any).mockRestore();
    (postProcessor.validateGeneratedCode as any).mockRestore();
    (promptGenerator.generateFixPrompt as any).mockRestore();
  })

  it('should succeed on the first attempt', async () => {
    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', false, 'ollama')
    expect(result.success).toBe(true)
    expect(result.attempts).toBe(1)
  })

  it('should succeed on the second attempt', async () => {
    (postProcessor.validateGeneratedCode as any)
        .mockResolvedValueOnce({ isValid: false, errors: ['still broken'] })
        .mockResolvedValueOnce({ isValid: true, errors: [] });

    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', false, 'ollama')
    expect(result.success).toBe(true)
    expect(result.attempts).toBe(2)
  })

  it('should fail after max retries', async () => {
    (postProcessor.validateGeneratedCode as any).mockResolvedValue({ isValid: false, errors: ['always broken'] })
    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', false, 'ollama', 2)
    expect(result.success).toBe(false)
    expect(result.attempts).toBe(2)
  })

  it('should handle errors during the fix attempt', async () => {
    (modelCaller.callOllamaModel as any).mockRejectedValue(new Error('API error'))
    const consoleErrorSpy = spyOn(console, 'error')
    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', true, 'ollama', 1)
    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('  -> Error during retry attempt 1: Error: API error')
    consoleErrorSpy.mockRestore()
  })
})
