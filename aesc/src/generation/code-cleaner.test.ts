import { describe, it, expect, spyOn } from 'bun:test'
import { cleanGeneratedCode } from './code-cleaner'

describe('cleanGeneratedCode', () => {
  it('should extract code from a TypeScript block and find the impl class', () => {
    const rawResponse = `
Some text before the code block.
\`\`\`typescript
import { ITest } from './test'

export class TestImpl implements ITest {
  // class implementation
}
\`\`\`
Some text after the code block.
    `
    const cleaned = cleanGeneratedCode(rawResponse, 'Test', false)
    expect(cleaned).toContain('export class TestImpl implements ITest')
    expect(cleaned).not.toContain('```')
  })

  it('should handle code without a TypeScript block', () => {
    const rawResponse = `
export class TestImpl implements ITest {
  // class implementation
}
    `
    const cleaned = cleanGeneratedCode(rawResponse, 'Test', false)
    expect(cleaned).toContain('export class TestImpl implements ITest')
  })

  it('should return the full response if the impl class is not found', () => {
    const rawResponse = `
\`\`\`typescript
export class AnotherClass {
  // class implementation
}
\`\`\`
    `
    const cleaned = cleanGeneratedCode(rawResponse, 'Test', false)
    expect(cleaned).toContain('export class AnotherClass')
  })

  it('should handle an empty string as input', () => {
    const cleaned = cleanGeneratedCode('', 'Test', false)
    expect(cleaned).toBe('')
  })

  it('should log verbose output when verbose is true', () => {
    const consoleLogSpy = spyOn(console, 'log')
    const rawResponse = `
\`\`\`typescript
export class TestImpl implements ITest {
  // class implementation
}
\`\`\`
    `
    cleanGeneratedCode(rawResponse, 'Test', true)
    expect(consoleLogSpy).toHaveBeenCalled()
    consoleLogSpy.mockRestore()
  })

  it('should log verbose warning when impl class is not found and verbose is true', () => {
    const consoleLogSpy = spyOn(console, 'log')
    const rawResponse = `
\`\`\`typescript
export class AnotherClass {
  // class implementation
}
\`\`\`
    `
    cleanGeneratedCode(rawResponse, 'Test', true)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `  -> WARN: Could not extract 'TestImpl' from response. Using the full response as fallback.`
    )
    consoleLogSpy.mockRestore()
  })
})
