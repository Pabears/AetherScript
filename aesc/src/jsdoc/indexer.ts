import * as fs from 'fs'
import * as path from 'path'
import { JSDocExtractor } from './extractor'

export interface JSDocCache {
  [libraryName: string]: {
    path: string
    indexedAt: string
  }
}

export class JSDocIndexer {
  private projectPath: string
  private jsdocDir: string
  private cache: JSDocCache = {}
  private cachePath: string

  constructor(
    projectPath: string,
    private fs_ = {
      existsSync: fs.existsSync,
      mkdirSync: fs.mkdirSync,
      readFileSync: (p: fs.PathOrFileDescriptor, e: BufferEncoding) =>
        fs.readFileSync(p, e),
      writeFileSync: fs.writeFileSync,
      readdirSync: fs.readdirSync,
    },
  ) {
    this.projectPath = projectPath
    this.jsdocDir = path.join(projectPath, '.jsdoc')
    this.cachePath = path.join(this.jsdocDir, 'node-cache.json')
    this.loadCache()
  }

  private loadCache() {
    if (this.fs_.existsSync(this.cachePath)) {
      try {
        this.cache = JSON.parse(
          this.fs_.readFileSync(this.cachePath, 'utf-8'),
        )
      } catch (error) {
        console.error('Error reading JSDoc cache:', error)
        this.cache = {}
      }
    }
  }

  private saveCache() {
    if (!this.fs_.existsSync(this.jsdocDir)) {
      this.fs_.mkdirSync(this.jsdocDir, { recursive: true })
    }
    this.fs_.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2))
  }

  public clearIndex() {
    this.cache = {}
    if (this.fs_.existsSync(this.jsdocDir)) {
      const files = this.fs_.readdirSync(this.jsdocDir)
      for (const file of files) {
        fs.unlinkSync(path.join(this.jsdocDir, file))
      }
    }
    console.log('JSDoc cache cleared.')
  }

  public getIndexedLibraries(): string[] {
    return Object.keys(this.cache)
  }

  public async indexAllDependencies() {
    const packageJsonPath = path.join(this.projectPath, 'package.json')
    if (!this.fs_.existsSync(packageJsonPath)) {
      console.warn('No package.json found. Skipping JSDoc indexing.')
      return
    }

    const packageJson = JSON.parse(
      this.fs_.readFileSync(packageJsonPath, 'utf-8'),
    )
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    console.log(
      `Indexing JSDoc for ${Object.keys(dependencies).length} dependencies...`,
    )

    const extractor = new JSDocExtractor(this.projectPath)
    for (const libName in dependencies) {
      if (this.cache[libName]) {
        console.log(`[JSDoc] Skipping already indexed: ${libName}`)
        continue
      }
      const jsdoc = extractor.extractLibraryJSDoc(libName)
      if (jsdoc) {
        this.cache[libName] = {
          path: path.join(this.jsdocDir, `${libName}.json`),
          indexedAt: new Date().toISOString(),
        }
      }
    }

    this.saveCache()
    console.log('JSDoc indexing complete.')
  }
}
