import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'
import { JSDocIndexer } from './indexer'
import { JSDocExtractor } from './extractor'

// Mock the JSDocExtractor
mock.module('./extractor', () => {
  return {
    JSDocExtractor: mock(() => ({
      extractLibraryJSDoc: mock((lib: string) => {
        if (lib === 'a-lib-with-jsdoc') {
          return { functions: [{ name: 'testFunc', signature: 'testFunc()' }] }
        }
        return null
      }),
    })),
  }
})

describe('JSDocIndexer', () => {
  const projectPath = '/test-project'
  const jsdocDir = path.join(projectPath, '.jsdoc')
  let indexer: JSDocIndexer
  let fsMocks: { [key: string]: any }

  beforeEach(() => {
    // In-memory representation of the file system
    const memoryFS: { [key: string]: string } = {}

    fsMocks = {
      existsSync: spyOn(fs, 'existsSync').mockImplementation((p) => memoryFS.hasOwnProperty(p.toString())),
      mkdirSync: spyOn(fs, 'mkdirSync').mockImplementation((p) => (memoryFS[p.toString()] = 'directory')),
      readFileSync: spyOn(fs, 'readFileSync').mockImplementation((p) => memoryFS[p.toString()]),
      writeFileSync: spyOn(fs, 'writeFileSync').mockImplementation((p, data) => (memoryFS[p.toString()] = data.toString())),
      readdirSync: spyOn(fs, 'readdirSync').mockImplementation((p) => {
        const dirPath = p.toString();
        const files = Object.keys(memoryFS)
          .filter(fp => fp.startsWith(dirPath) && fp !== dirPath && fp.split('/').length === dirPath.split('/').length + 1)
          .map(fp => path.basename(fp));
        return files;
      }),
      unlinkSync: spyOn(fs, 'unlinkSync').mockImplementation(p => delete memoryFS[p.toString()]),
    }

    // Pre-populate with package.json
    memoryFS[path.join(projectPath, 'package.json')] = JSON.stringify({
      dependencies: { 'a-lib-with-jsdoc': '1.0.0', 'a-lib-without-jsdoc': '1.0.0' },
      devDependencies: { '@types/some-lib': '1.0.0' },
    })

    indexer = new JSDocIndexer(projectPath)
  })

  afterEach(() => {
    // Restore all mocks
    Object.values(fsMocks).forEach(mock => mock.mockRestore())
  })

  it('should create .jsdoc directory if it does not exist', () => {
    expect(fsMocks.mkdirSync).toHaveBeenCalledWith(jsdocDir, { recursive: true })
  })

  it('should index all dependencies from package.json', async () => {
    await indexer.indexAllDependencies()
    const libPath = path.join(jsdocDir, 'a-lib-with-jsdoc.json')
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(libPath, expect.any(String))
    const writtenData = JSON.parse((fsMocks.writeFileSync as any).mock.calls[0][1])
    expect(writtenData.functions[0].name).toBe('testFunc')
  })

  it('should skip @types packages', async () => {
    await indexer.indexAllDependencies()
    const typesLibPath = path.join(jsdocDir, '@types/some-lib.json')
    expect(fsMocks.writeFileSync).not.toHaveBeenCalledWith(typesLibPath, expect.any(String))
  })

  it('should skip already indexed packages', async () => {
    // Pre-mark 'a-lib-with-jsdoc' as existing
    (fsMocks.existsSync as any).mockImplementation((p: string) => {
      return p.endsWith('a-lib-with-jsdoc.json') || p.endsWith('package.json')
    })

    await indexer.indexAllDependencies()
    const libPath = path.join(jsdocDir, 'a-lib-with-jsdoc.json')
    expect(fsMocks.writeFileSync).not.toHaveBeenCalledWith(libPath, expect.any(String))
  })

  it('should load JSDoc for an indexed library', () => {
    const libPath = path.join(jsdocDir, 'a-lib-with-jsdoc.json')
    fsMocks.writeFileSync(libPath, JSON.stringify({ functions: [{name: 'cachedFunc'}] }))

    const jsdoc = indexer.loadLibraryJSDoc('a-lib-with-jsdoc')
    expect(jsdoc).toBeDefined()
    expect(jsdoc!.functions[0].name).toBe('cachedFunc')
  })

  it('should return null when loading JSDoc for a non-indexed library', () => {
    const jsdoc = indexer.loadLibraryJSDoc('non-existent-lib')
    expect(jsdoc).toBeNull()
  })

  it('should get all indexed library names', () => {
    fsMocks.writeFileSync(path.join(jsdocDir, 'lib1.json'), '{}')
    fsMocks.writeFileSync(path.join(jsdocDir, 'lib2.json'), '{}')

    const libs = indexer.getIndexedLibraries()
    expect(libs).toEqual(expect.arrayContaining(['lib1', 'lib2']))
    expect(libs.length).toBe(2)
  })

  it('should clear the index cache', () => {
    fsMocks.writeFileSync(path.join(jsdocDir, 'lib1.json'), '{}')
    fsMocks.writeFileSync(path.join(jsdocDir, 'lib2.json'), '{}')

    indexer.clearIndex()

    expect(fsMocks.unlinkSync).toHaveBeenCalledWith(path.join(jsdocDir, 'lib1.json'))
    expect(fsMocks.unlinkSync).toHaveBeenCalledWith(path.join(jsdocDir, 'lib2.json'))
  })
})
