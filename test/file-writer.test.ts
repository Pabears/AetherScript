import { test, describe, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { FileWriterImpl } from '../src/generated/file-writer.impl.ts'
import type { WriteOperation } from '../src/abstracts/file-writer.ts'

let tmpDir: string
let writer: FileWriterImpl

const makeFile = (filename: string, src = `// ${filename}`) => ({
  className: 'Foo',
  implClassName: 'FooImpl',
  filename,
  sourceCode: src,
  diRegistration: {
    abstractName: 'Foo',
    implName: 'FooImpl',
    importPath: `./${filename}`,
  },
})

const makeOp = (files = [makeFile('foo.impl.ts')], root = tmpDir): WriteOperation => ({
  files,
  projectRoot: root,
})

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aether-fw-test-'))
  writer = new FileWriterImpl()
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('FileWriter', () => {
  test('1. write() 正常写入文件，返回正确 WriteResult', async () => {
    const result = await writer.write(makeOp())
    const generatedDir = path.join(tmpDir, 'src', 'generated')
    const written = path.join(generatedDir, 'foo.impl.ts')

    expect(result.dryRun).toBe(false)
    expect(result.writtenFiles).toContain(written)
    const content = await fs.readFile(written, 'utf-8')
    expect(content).toBe('// foo.impl.ts')
  })

  test('2. dryRun=true 时不实际写入文件', async () => {
    const result = await writer.write(makeOp(), true)
    const generatedDir = path.join(tmpDir, 'src', 'generated')
    const written = path.join(generatedDir, 'foo.impl.ts')

    expect(result.dryRun).toBe(true)
    expect(result.writtenFiles).toContain(written)
    // 文件不应存在
    await expect(fs.access(written)).rejects.toThrow()
  })

  test('3. mergeContainer() 正确合并 DI 注册，不重复', async () => {
    const containerPath = path.join(tmpDir, 'container.ts')
    const reg = { abstractName: 'IBar', implName: 'BarImpl', importPath: './bar.impl' }

    // 第一次写入
    const content1 = await writer.mergeContainer(containerPath, [reg])
    expect(content1).toContain(`import { BarImpl } from './bar.impl';`)
    expect(content1).toContain('container.bind<IBar>(BarImpl);')

    // 第二次写入相同注册，不应出现重复
    const content2 = await writer.mergeContainer(containerPath, [reg])
    const importCount = (content2.match(/import \{ BarImpl \}/g) || []).length
    const bindCount = (content2.match(/container\.bind<IBar>/g) || []).length
    expect(importCount).toBe(1)
    expect(bindCount).toBe(1)
  })

  test('4. rollback() 恢复到写入前的状态', async () => {
    const generatedDir = path.join(tmpDir, 'src', 'generated')
    await fs.mkdir(generatedDir, { recursive: true })

    const targetFile = path.join(generatedDir, 'bar.impl.ts')
    const original = '// original content'
    await fs.writeFile(targetFile, original, 'utf-8')

    // 写入新内容会触发事务，然后手动 rollback
    const op = makeOp([makeFile('bar.impl.ts', '// new content')])

    // 注入一个故意失败的文件来触发自动 rollback
    const badOp: WriteOperation = {
      projectRoot: tmpDir,
      files: [
        makeFile('bar.impl.ts', '// new content'),
        // 第二个文件 sourceCode 不是 string，触发 validateWriteOperation throw
        { ...makeFile('bad.impl.ts'), sourceCode: null as any },
      ],
    }

    await expect(writer.write(badOp)).rejects.toThrow()

    // 原文件应被恢复
    const restored = await fs.readFile(targetFile, 'utf-8')
    expect(restored).toBe(original)
  })

  test('5. filename 含 ../../ 路径穿越时 throw', async () => {
    const op = makeOp([makeFile('../../evil.ts')])
    await expect(writer.write(op)).rejects.toThrow(/Path traversal blocked/)
  })

  test('6. 多文件并发写入结果一致', async () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      makeFile(`module${i}.impl.ts`, `// module ${i}`)
    )
    const result = await writer.write(makeOp(files))
    const generatedDir = path.join(tmpDir, 'src', 'generated')

    expect(result.writtenFiles).toHaveLength(5)

    await Promise.all(
      files.map(async (f, i) => {
        const content = await fs.readFile(path.join(generatedDir, f.filename), 'utf-8')
        expect(content).toBe(`// module ${i}`)
      })
    )
  })
})
