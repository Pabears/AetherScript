import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { fixGeneratedCode } from '../../src/generation/code-fixer';
import * as modelCaller from '../../src/model-caller';
import * as codeCleaner from '../../src/generation/code-cleaner';
import * as postProcessor from '../../src/generation/post-processor';
import * as promptGenerator from '../../src/prompt-generator';
import { Project, InterfaceDeclaration } from 'ts-morph';

describe('fixGeneratedCode', () => {
  let project: Project;
  let declaration: InterfaceDeclaration;
  const spies: any[] = [];

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'test.ts',
      'export interface ITest {}',
    );
    declaration = sourceFile.getInterfaceOrThrow('ITest');

    // Mock dependencies
    spies.push(spyOn(modelCaller, 'callOllamaModel').mockResolvedValue('fixed code response'));
    spies.push(spyOn(postProcessor, 'validateGeneratedCode').mockResolvedValue({ isValid: true, errors: [] }));
    spies.push(spyOn(promptGenerator, 'generateFixPrompt').mockReturnValue('fix prompt'));
  });

  afterEach(() => {
    for (const spy of spies) {
      spy.mockRestore();
    }
    spies.length = 0;
  });

  it('should succeed on the first attempt', async () => {
    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', false, 'ollama');
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('should succeed on the second attempt', async () => {
    (postProcessor.validateGeneratedCode as any)
        .mockResolvedValueOnce({ isValid: false, errors: ['still broken'] })
        .mockResolvedValueOnce({ isValid: true, errors: [] });

    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', false, 'ollama');
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('should fail after max retries', async () => {
    (postProcessor.validateGeneratedCode as any).mockResolvedValue({ isValid: false, errors: ['always broken'] });
    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', false, 'ollama', 2);
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
  });

  it('should handle errors during the fix attempt', async () => {
    (modelCaller.callOllamaModel as any).mockRejectedValue(new Error('API error'));
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    spies.push(consoleErrorSpy);
    const result = await fixGeneratedCode('original code', declaration, 'impl/path', 'import/path', 'ITest', ['error1'], 'model', true, 'ollama', 1);
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('  -> Error during retry attempt 1: Error: API error');
  });
});
