import {
  describe,
  it,
  expect,
  mock,
  spyOn,
  afterEach,
  beforeEach,
} from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'
import { Project, ClassDeclaration, InterfaceDeclaration } from 'ts-morph'
import {
  getAllExistingServices,
  generateCode,
  type GenerationResult,
  type FileStats,
} from './generator'
import type { GenerateOptions } from '../types'

// Mock child modules
const fileAnalysis = {
  analyzeSourceFiles: mock(() => new Map()),
  getDependencies: mock(() => ({ constructorDeps: [], propertyDeps: [] })),
}
const promptGenerator = {
  generatePrompt: mock(() => 'mocked prompt'),
}
const modelCaller = {
  callOllamaModel: mock(async () => 'mocked response'),
}
const codeCleaner = {
  cleanGeneratedCode: mock(() => 'mocked cleaned code'),
}
const postProcessor = {
  postProcessGeneratedCode: mock(() => 'mocked processed code'),
  validateGeneratedCode: mock(async () => ({ isValid: true, errors: [] })),
}
const fileSaver = {
  generateContainer: mock(async () => {}),
  saveGeneratedFile: mock(() => {}),
  ensureOutputDirectory: mock(() => {}),
  getLockData: mock(() => []),
}
const codeFixer = {
  fixGeneratedCode: mock(async () => ({
    success: true,
    fixedCode: 'mocked fixed code',
  })),
}
const config = {
  getConfig: mock(() => ({ outputDir: 'src/generated' })),
}
const jsdoc = {
  JSDocIndexer: mock(() => ({
    indexAllDependencies: mock(async () => {}),
    getIndexedLibraries: mock(() => []),
  })),
}

mock.module('../file-analysis', () => fileAnalysis)
mock.module('../prompt-generator', () => promptGenerator)
mock.module('../model-caller', () => modelCaller)
mock.module('../generation/code-cleaner', () => codeCleaner)
mock.module('../generation/post-processor', () => postProcessor)
mock.module('../file-saver', () => fileSaver)
mock.module('../generation/code-fixer', () => codeFixer)
mock.module('../config', () => config)
mock.module('../jsdoc/indexer', () => ({ JSDocIndexer: jsdoc.JSDocIndexer }))

describe('generator', () => {
  let project: Project
  const spies: { mockRestore: () => void }[] = []

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true })
    // Reset mocks before each test
    Object.values(fileAnalysis).forEach((m) => m.mockClear())
    Object.values(promptGenerator).forEach((m) => m.mockClear())
    Object.values(modelCaller).forEach((m) => m.mockClear())
    Object.values(codeCleaner).forEach((m) => m.mockClear())
    Object.values(postProcessor).forEach((m) => m.mockClear())
    Object.values(fileSaver).forEach((m) => m.mockClear())
    Object.values(codeFixer).forEach((m) => m.mockClear())
    Object.values(config).forEach((m) => m.mockClear())
    spies.forEach((spy) => spy.mockRestore())
    spies.length = 0
    // Explicitly reset mocks that are changed in specific tests
    fileSaver.getLockData.mockReturnValue([])
    modelCaller.callOllamaModel.mockResolvedValue('mocked response')
    postProcessor.validateGeneratedCode.mockResolvedValue({ isValid: true, errors: [] })
  })

  afterEach(() => {
    spies.forEach((spy) => spy.mockRestore())
    spies.length = 0
  })

  describe('generateCode', () => {
    const mockOptions: GenerateOptions = {
      force: false,
      verbose: false,
      files: [],
      model: 'test-model',
      provider: 'ollama',
    }

    it('should run the full generation process successfully', async () => {
      // Arrange
      const sourceFile = project.createSourceFile(
        'src/services/user-service.ts',
        'export abstract class UserService {}',
      )
      const declaration = sourceFile.getClass('UserService')!
      const servicesToGenerate = new Map([['UserService', { declaration }]])
      fileAnalysis.analyzeSourceFiles.mockReturnValue(servicesToGenerate)
      spyOn(fs, 'existsSync').mockReturnValue(false)

      // Act
      const result: GenerationResult = await generateCode(mockOptions)

      // Assert
      expect(result.success).toBe(true)
      expect(result.fileStats.length).toBe(1)
      expect(result.fileStats[0].status).toBe('generated')
      expect(fileSaver.ensureOutputDirectory).toHaveBeenCalledWith(
        expect.any(String),
        false,
      )
      expect(promptGenerator.generatePrompt).toHaveBeenCalled()
      expect(modelCaller.callOllamaModel).toHaveBeenCalled()
      expect(codeCleaner.cleanGeneratedCode).toHaveBeenCalled()
      expect(postProcessor.postProcessGeneratedCode).toHaveBeenCalled()
      expect(postProcessor.validateGeneratedCode).toHaveBeenCalled()
      expect(fileSaver.saveGeneratedFile).toHaveBeenCalled()
      expect(fileSaver.generateContainer).toHaveBeenCalled()
    })

    it('should skip locked files', async () => {
      // Arrange
      const sourceFile = project.createSourceFile(
        'src/services/user-service.ts',
        'export abstract class UserService {}',
      )
      const declaration = sourceFile.getClass('UserService')!
      const servicesToGenerate = new Map([['UserService', { declaration }]])
      fileAnalysis.analyzeSourceFiles.mockReturnValue(servicesToGenerate)
      const outputDir = path.join(process.cwd(), 'src/generated')
      const implFilePath = path.join(
        outputDir,
        'userservice.service.impl.ts',
      )
      fileSaver.getLockData.mockReturnValue([implFilePath])
      const resolveSpy = spyOn(path, 'resolve').mockReturnValue(implFilePath)
      spies.push(resolveSpy)

      // Act
      const result = await generateCode(mockOptions)

      // Assert
      expect(result.fileStats[0].status).toBe('locked')
      expect(modelCaller.callOllamaModel).not.toHaveBeenCalled()
    })

    it('should handle generation errors gracefully', async () => {
      // Arrange
      const sourceFile = project.createSourceFile(
        'src/services/user-service.ts',
        'export abstract class UserService {}',
      )
      const declaration = sourceFile.getClass('UserService')!
      const servicesToGenerate = new Map([['UserService', { declaration }]])
      fileAnalysis.analyzeSourceFiles.mockReturnValue(servicesToGenerate)
      modelCaller.callOllamaModel.mockRejectedValue(new Error('API Error'))

      // Act
      const result = await generateCode(mockOptions)

      // Assert
      expect(result.success).toBe(false)
      expect(result.fileStats[0].status).toBe('error')
      expect(result.fileStats[0].error).toContain('API Error')
    })

    it('should attempt to fix code on validation failure', async () => {
        // Arrange
        const sourceFile = project.createSourceFile('src/services/user-service.ts', 'export abstract class UserService {}');
        const declaration = sourceFile.getClass('UserService')!;
        const servicesToGenerate = new Map([['UserService', { declaration }]]);
        fileAnalysis.analyzeSourceFiles.mockReturnValue(servicesToGenerate);

        postProcessor.validateGeneratedCode
            .mockResolvedValueOnce({ isValid: false, errors: ['Syntax Error'] })
            .mockResolvedValueOnce({ isValid: true, errors: [] }); // After fix

        codeFixer.fixGeneratedCode.mockResolvedValue({
            success: true,
            fixedCode: 'mocked fixed code',
            attempts: 1,
        });

        // Act
        await generateCode(mockOptions);

        // Assert
        expect(codeFixer.fixGeneratedCode).toHaveBeenCalled();
        expect(fileSaver.saveGeneratedFile).toHaveBeenCalledWith(expect.any(String), 'mocked fixed code');
    });
  })

  describe('getAllExistingServices', () => {
    it('should return only newly generated services if output directory does not exist', async () => {
      // Arrange
      const existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(false)
      spies.push(existsSyncSpy)

      const newlyGenerated = [
        {
          interfaceName: 'ServiceA',
          implName: 'ServiceAImpl',
          implFilePath: './ServiceA.ts',
          constructorDependencies: [],
          propertyDependencies: [],
        },
      ]

      // Act
      const result = await getAllExistingServices(
        '/output',
        project,
        newlyGenerated,
      )

      // Assert
      expect(result).toEqual(newlyGenerated)
      expect(existsSyncSpy).toHaveBeenCalledWith('/output')
    })

    it('should return an empty array if output directory exists but is empty and no new services are provided', async () => {
      // Arrange
      const existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(true)
      spies.push(existsSyncSpy)
      const readdirSyncSpy = spyOn(fs, 'readdirSync').mockReturnValue([])
      spies.push(readdirSyncSpy)

      // Act
      const result = await getAllExistingServices('/output', project, [])

      // Assert
      expect(result).toEqual([])
      expect(existsSyncSpy).toHaveBeenCalledWith('/output')
      expect(readdirSyncSpy).toHaveBeenCalledWith('/output')
    })
  })
})
