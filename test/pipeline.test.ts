import { test, describe, expect, mock } from 'bun:test'
import { PipelineImpl } from '../src/generated/pipeline.impl.ts'

// ── shared mock factories ────────────────────────────────────

const scanResult = {
  classes: [{ className: 'Foo', filePath: 'foo.ts', sourceText: '', typeContext: '', methodSignatures: [], imports: [] }],
  projectRoot: '/proj',
  tsconfigPath: '/proj/tsconfig.json',
  fileHashes: new Map(),
  scannedAt: 0,
}
const sanitizeResult = {
  payload: { classes: scanResult.classes },
  report: { riskLevel: 'safe' as const, warnings: [] },
}
const generationResult = {
  files: [{ className: 'Foo', implClassName: 'FooImpl', filename: 'foo.impl.ts', sourceCode: 'export class FooImpl {}', diRegistration: { abstractName: 'Foo', implName: 'FooImpl', importPath: './foo.impl.ts' } }],
  usage: { inputTokens: 10, outputTokens: 20, estimatedCostUsd: 0.001 },
}
const validationResult = { passed: true, issues: [] }
const writeResult = { writtenFiles: ['foo.impl.ts'] }
const costReport = { totalInputTokens: 10, totalOutputTokens: 20, totalCostUsd: 0.001, callCount: 1, breakdown: [] }

function makeDeps(overrides: Record<string, Partial<Record<string, unknown>>> = {}) {
  const scanner = { scan: mock(async () => scanResult), ...overrides.scanner }
  const sanitizer = { sanitize: mock(async () => sanitizeResult), ...overrides.sanitizer }
  const generator = { generate: mock(async () => generationResult), ...overrides.generator }
  const validator = { validateAll: mock(async () => validationResult), ...overrides.validator }
  const writer = { write: mock(async () => writeResult), rollback: mock(async () => {}), ...overrides.writer }
  const llm = { ping: mock(async () => true), ...overrides.llm }
  const tracker = { record: mock(() => {}), getReport: mock(() => costReport), ...overrides.tracker }
  return { scanner, sanitizer, generator, validator, writer, llm, tracker } as any
}

const BASE_CONFIG = { projectDir: '/proj' }

describe('PipelineImpl', () => {
  test('1. run() 成功完成，返回 success=true，filesWritten 非空', async () => {
    const deps = makeDeps()
    const pipeline = new PipelineImpl(...Object.values(deps))
    const result = await pipeline.run(BASE_CONFIG)
    expect(result.success).toBe(true)
    expect(result.filesWritten.length).toBeGreaterThan(0)
  })

  test('2. onEvent() hook 被正确调用（含 5 个阶段的 start/success 事件）', async () => {
    const deps = makeDeps()
    const pipeline = new PipelineImpl(...Object.values(deps))
    const events: Array<{ stage: string; status: string }> = []
    pipeline.onEvent(e => events.push({ stage: e.stage, status: e.status }))
    await pipeline.run(BASE_CONFIG)
    const stages = ['scan', 'sanitize', 'generate', 'validate', 'write']
    for (const stage of stages) {
      expect(events.some(e => e.stage === stage && e.status === 'start')).toBe(true)
      expect(events.some(e => e.stage === stage && e.status === 'success')).toBe(true)
    }
  })

  test('3. dryRun=true 时 writer.write 以 dryRun=true 调用（不实际写入）', async () => {
    const deps = makeDeps()
    const pipeline = new PipelineImpl(...Object.values(deps))
    await pipeline.run({ ...BASE_CONFIG, dryRun: true })
    expect(deps.writer.write).toHaveBeenCalledTimes(1)
    const [, dryRunArg] = deps.writer.write.mock.calls[0]
    expect(dryRunArg).toBe(true)
  })

  test('4. config.projectDir 为空时立即报错', async () => {
    const deps = makeDeps()
    const pipeline = new PipelineImpl(...Object.values(deps))
    const result = await pipeline.run({ projectDir: '' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/projectDir/)
    expect(deps.llm.ping).not.toHaveBeenCalled()
  })

  test('5. llm.ping() 失败时 run() 提前返回错误', async () => {
    const deps = makeDeps({ llm: { ping: mock(async () => { throw new Error('network down') }) } })
    const pipeline = new PipelineImpl(...Object.values(deps))
    const result = await pipeline.run(BASE_CONFIG)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/network down/)
    expect(deps.scanner.scan).not.toHaveBeenCalled()
  })

  test('6. write 阶段失败后 rollback() 被调用', async () => {
    const deps = makeDeps({ writer: { write: mock(async () => { throw new Error('disk full') }), rollback: mock(async () => {}) } })
    const pipeline = new PipelineImpl(...Object.values(deps))
    const result = await pipeline.run(BASE_CONFIG)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/disk full/)
    expect(deps.writer.rollback).toHaveBeenCalledTimes(1)
  })
})
