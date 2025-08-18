import { Project, InterfaceDeclaration, ClassDeclaration, Node, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { mock, spyOn, describe, it, expect, beforeEach, afterAll } from 'bun:test';

const allMocks: any[] = [];
// A simple replacement for bun:test's fn
function fn(implementation?: (...args: any[]) => any) {
  const mockFn = (...args: any[]) => {
    mockFn.calls.push(args);
    if (mockFn.implementation) {
      return mockFn.implementation(...args);
    }
    return undefined;
  };
  mockFn.calls = [] as any[][];
  mockFn.implementation = implementation;
  mockFn.mockImplementation = (newImplementation: (...args: any[]) => any) => {
    mockFn.implementation = newImplementation;
    return mockFn;
  };
  allMocks.push(mockFn);
  return mockFn;
}

// Import the functions to be tested
import { getAllExistingServices, generateSingleService, generateCode } from './generator';

// Import actual modules to mock their functions
import * as fileAnalysis from '../file-analysis';
import * as promptGenerator from '../prompt-generator';
import * as modelCaller from '../model-caller';
import * as codeCleaner from '../generation/code-cleaner';
import * as postProcessor from '../generation/post-processor';
import * as fileSaver from '../file-saver';
import * as codeFixer from '../generation/code-fixer';
import * as config from '../config';
import { JSDocIndexer } from '../jsdoc/indexer'; // Import the class directly

// Mock external dependencies
mock.module('../file-analysis', () => ({
  analyzeSourceFiles: fn(),
  getDependencies: fn(),
}));
mock.module('../prompt-generator', () => ({
  generatePrompt: fn(),
}));
mock.module('../model-caller', () => ({
  callOllamaModel: fn(),
}));
mock.module('../generation/code-cleaner', () => ({
  cleanGeneratedCode: fn(),
}));
mock.module('../generation/post-processor', () => ({
  postProcessGeneratedCode: fn(),
  validateGeneratedCode: fn(),
}));
mock.module('../file-saver', () => ({
  generateContainer: fn(),
  saveGeneratedFile: fn(),
  ensureOutputDirectory: fn(),
  getLockData: fn(),
}));
mock.module('../generation/code-fixer', () => ({
  fixGeneratedCode: fn(),
}));
mock.module('../config', () => ({
  getConfig: fn(() => ({ outputDir: 'generated' })),
}));
mock.module('../jsdoc/indexer', () => ({
  JSDocIndexer: fn().mockImplementation(() => ({
    indexAllDependencies: fn(),
    getIndexedLibraries: fn(() => []),
  })),
}));


// Mock console.log and console.error to prevent clutter during tests
const mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = spyOn(console, 'warn').mockImplementation(() => {});

describe('generator', () => {
  let project: Project;
  let mockFsExistsSync: any;
  let mockFsReaddirSync: any;
  let mockFsUnlinkSync: any;
  let mockProjectAddSourceFileAtPath: any;

  beforeEach(() => {
    // Reset my custom mocks
    for (const mock of allMocks) {
      mock.calls = [];
    }

    project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        lib: ["es5", "dom"],
      },
    });

    // Mocks are automatically restored between tests in Bun

    // Mock fs functions
    mockFsExistsSync = spyOn(fs, 'existsSync');
    mockFsReaddirSync = spyOn(fs, 'readdirSync');
    mockFsUnlinkSync = spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    // Mock project.addSourceFileAtPath
    mockProjectAddSourceFileAtPath = spyOn(project, 'addSourceFileAtPath');
  });

  afterAll(() => {
    // Restore console after all tests are done
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  describe('getAllExistingServices', () => {
    it('should return newly generated services if output directory does not exist', async () => {
      mockFsExistsSync.mockReturnValue(false);
      const newlyGenerated = [{ interfaceName: 'ServiceA', implName: 'ServiceAImpl', implFilePath: './ServiceA.ts', constructorDependencies: [], propertyDependencies: [] }];
      const result = await getAllExistingServices('/output', project, newlyGenerated);
      expect(result).toEqual(newlyGenerated);
      expect(mockFsExistsSync).toHaveBeenCalledWith('/output');
      expect(mockFsReaddirSync).not.toHaveBeenCalled();
    });

    it('should return newly generated services if output directory exists but contains no service files', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReaddirSync.mockReturnValue([]);
      const newlyGenerated = [{ interfaceName: 'ServiceA', implName: 'ServiceAImpl', implFilePath: './ServiceA.ts', constructorDependencies: [], propertyDependencies: [] }];
      const result = await getAllExistingServices('/output', project, newlyGenerated);
      expect(result).toEqual(newlyGenerated);
      expect(mockFsExistsSync).toHaveBeenCalledWith('/output');
      expect(mockFsReaddirSync).toHaveBeenCalledWith('/output');
    });

    it('should combine newly generated and existing services, skipping duplicates', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReaddirSync.mockReturnValue(['serviceb.service.impl.ts', 'servicea.service.impl.ts', 'other.txt']);

      // Mock project.addSourceFileAtPath to return a mock SourceFile
      const mockSourceFileA = project.createSourceFile('src/servicea.service.impl.ts', `
        class ServiceAImpl {}
      `);
      const mockSourceFileB = project.createSourceFile('src/serviceb.service.impl.ts', `
        class ServiceBImpl {
          constructor(private dep: DepType) {}
        }
      `);
      mockProjectAddSourceFileAtPath.mockImplementation((filePath) => {
        if (filePath.includes('servicea.service.impl.ts')) return mockSourceFileA;
        if (filePath.includes('serviceb.service.impl.ts')) return mockSourceFileB;
        return project.createSourceFile(filePath); // Fallback for other files
      });

      // Access the mocked getDependencies from the imported module
      fileAnalysis.getDependencies.mockImplementation((cls: ClassDeclaration) => {
        if (cls.getName() === 'ServiceAImpl') {
          return { constructorDeps: [], propertyDeps: [] };
        }
        if (cls.getName() === 'ServiceBImpl') {
          return { constructorDeps: ['DepType'], propertyDeps: [] };
        }
        return { constructorDeps: [], propertyDeps: [] };
      });

      const newlyGenerated = [{ interfaceName: 'ServiceA', implName: 'ServiceAImpl', implFilePath: './ServiceA.ts', constructorDependencies: [], propertyDependencies: [] }];
      const result = await getAllExistingServices('/output', project, newlyGenerated);

      expect(result.length).toBe(2);
      expect(result).toContainEqual(newlyGenerated[0]); // ServiceA is a duplicate, should be skipped from existing
      expect(result).toContainEqual({
        interfaceName: 'Serviceb',
        implName: 'ServiceBImpl',
        implFilePath: './serviceb.service.impl.ts', // Path should be relative to outputDir
        constructorDependencies: ['DepType'],
        propertyDependencies: [],
      });
      expect(mockProjectAddSourceFileAtPath).toHaveBeenCalledTimes(1); // For serviceb, servicea is skipped
      expect(mockConsoleWarn).not.toHaveBeenCalled(); // No warnings expected
    });

    it('should handle errors when analyzing existing service files', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReaddirSync.mockReturnValue(['error.service.impl.ts']);
      mockProjectAddSourceFileAtPath.mockImplementation(() => {
        throw new Error('Failed to add source file');
      });

      const newlyGenerated: any[] = [];
      const result = await getAllExistingServices('/output', project, newlyGenerated);

      expect(result).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Could not analyze existing service file error.service.impl.ts')
      );
    });
  });

  describe('generateCode', () => {
    it('should successfully generate a single service', async () => {
      const options = {
        files: [],
        force: false,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );
      (fileSaver.getLockData as any).mockImplementation(() => []);
      mockFsExistsSync.mockReturnValue(false); // Ensure file does not exist

      // Mock dependencies of generateSingleService
      (promptGenerator.generatePrompt as any).mockImplementation(() => 'prompt');
      (modelCaller.callOllamaModel as any).mockImplementation(() => Promise.resolve('raw response'));
      (codeCleaner.cleanGeneratedCode as any).mockImplementation(() => 'cleaned code');
      (postProcessor.postProcessGeneratedCode as any).mockImplementation(() => 'processed code');
      (postProcessor.validateGeneratedCode as any).mockImplementation(() => Promise.resolve({ isValid: true }));
      (fileAnalysis.getDependencies as any).mockImplementation(() => ({ constructorDeps: [], propertyDeps: [] }));

      const result = await generateCode(options);

      expect(result.success).toBe(true);
      expect(result.fileStats.length).toBe(1);
      expect(result.fileStats[0].status).toBe('generated');
      expect((fileSaver.ensureOutputDirectory as any).calls.length).toBe(1);
      expect((fileSaver.saveGeneratedFile as any).calls.length).toBe(1);
      expect((fileSaver.saveGeneratedFile as any).calls[0][0]).toEqual(
        expect.stringContaining('iservicea.service.impl.ts')
      );
      expect((fileSaver.saveGeneratedFile as any).calls[0][1]).toBe('processed code');
      expect((fileSaver.generateContainer as any).calls.length).toBe(1);
    });

    it('should overwrite existing files when force is true', async () => {
      const options = {
        files: ['iservicea.ts'], // Target a specific file
        force: true,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );
      (fileSaver.getLockData as any).mockImplementation(() => []);

      // Mock that the file exists
      mockFsExistsSync.mockReturnValue(true);
      mockFsReaddirSync.mockReturnValue([]);

      // Mock dependencies of generateSingleService
      (promptGenerator.generatePrompt as any).mockImplementation(() => 'prompt');
      (modelCaller.callOllamaModel as any).mockImplementation(() => Promise.resolve('raw response'));
      (codeCleaner.cleanGeneratedCode as any).mockImplementation(() => 'cleaned code');
      (postProcessor.postProcessGeneratedCode as any).mockImplementation(() => 'processed code');
      (postProcessor.validateGeneratedCode as any).mockImplementation(() => Promise.resolve({ isValid: true }));
      (fileAnalysis.getDependencies as any).mockImplementation(() => ({ constructorDeps: [], propertyDeps: [] }));

      const result = await generateCode(options);

      expect(result.success).toBe(true);
      // Check that unlinkSync was called because force was true
      expect(mockFsUnlinkSync).toHaveBeenCalledTimes(1);
      expect((fileSaver.saveGeneratedFile as any).calls.length).toBe(1);
    });

    it('should skip locked files', async () => {
      const options = {
        files: [],
        force: false,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );

      // Mock that the file is locked
      const implFilePath = path.resolve(process.cwd(), 'generated/iservicea.service.impl.ts');
      (fileSaver.getLockData as any).mockImplementation(() => [implFilePath]);

      const result = await generateCode(options);

      expect(result.success).toBe(true);
      expect(result.fileStats.length).toBe(1);
      expect(result.fileStats[0].status).toBe('locked');
      expect((fileSaver.saveGeneratedFile as any).calls.length).toBe(0);
    });

    it('should fix validation errors if possible', async () => {
      const options = {
        files: [],
        force: false,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );
      (fileSaver.getLockData as any).mockImplementation(() => []);
      mockFsExistsSync.mockReturnValue(false);

      // Mock dependencies
      (promptGenerator.generatePrompt as any).mockImplementation(() => 'prompt');
      (modelCaller.callOllamaModel as any).mockImplementation(() => Promise.resolve('raw response'));
      (codeCleaner.cleanGeneratedCode as any).mockImplementation(() => 'cleaned code');
      (postProcessor.postProcessGeneratedCode as any).mockImplementation(() => 'processed code');

      // Mock validation failure and successful fix
      (postProcessor.validateGeneratedCode as any).mockImplementation(() =>
        Promise.resolve({ isValid: false, errors: ['error'] })
      );
      (codeFixer.fixGeneratedCode as any).mockImplementation(() =>
        Promise.resolve({ success: true, fixedCode: 'fixed code', attempts: 1 })
      );

      (fileAnalysis.getDependencies as any).mockImplementation(() => ({ constructorDeps: [], propertyDeps: [] }));

      const result = await generateCode(options);

      expect(result.success).toBe(true);
      expect(result.fileStats[0].status).toBe('generated');
      expect((codeFixer.fixGeneratedCode as any).calls.length).toBe(1);
      expect((fileSaver.saveGeneratedFile as any).calls[0][1]).toBe('fixed code');
    });

    it('should return an error if validation fails and cannot be fixed', async () => {
      const options = {
        files: [],
        force: false,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );
      (fileSaver.getLockData as any).mockImplementation(() => []);
      mockFsExistsSync.mockReturnValue(false);

      // Mock dependencies
      (promptGenerator.generatePrompt as any).mockImplementation(() => 'prompt');
      (modelCaller.callOllamaModel as any).mockImplementation(() => Promise.resolve('raw response'));
      (codeCleaner.cleanGeneratedCode as any).mockImplementation(() => 'cleaned code');
      (postProcessor.postProcessGeneratedCode as any).mockImplementation(() => 'processed code');

      // Mock validation failure and failed fix
      (postProcessor.validateGeneratedCode as any).mockImplementation(() =>
        Promise.resolve({ isValid: false, errors: ['error'] })
      );
      (codeFixer.fixGeneratedCode as any).mockImplementation(() =>
        Promise.resolve({ success: false, fixedCode: null, attempts: 1 })
      );

      (fileAnalysis.getDependencies as any).mockImplementation(() => ({ constructorDeps: [], propertyDeps: [] }));

      const result = await generateCode(options);

      expect(result.success).toBe(false);
      expect(result.fileStats.length).toBe(1);
      expect(result.fileStats[0].status).toBe('error');
      expect((fileSaver.saveGeneratedFile as any).calls.length).toBe(0);
    });

    it('should skip existing files without force', async () => {
      const options = {
        files: [],
        force: false,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );
      (fileSaver.getLockData as any).mockImplementation(() => []);

      // Mock that the file exists
      mockFsExistsSync.mockReturnValue(true);

      const result = await generateCode(options);

      expect(result.success).toBe(true);
      expect(result.fileStats.length).toBe(1);
      expect(result.fileStats[0].status).toBe('skipped');
      expect((fileSaver.saveGeneratedFile as any).calls.length).toBe(0);
    });

    it('should do nothing if no services are found', async () => {
      const options = {
        files: [],
        force: false,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() => new Map());
      (fileSaver.getLockData as any).mockImplementation(() => []);
      mockFsExistsSync.mockReturnValue(false);

      const result = await generateCode(options);

      expect(result.success).toBe(true);
      expect(result.fileStats.length).toBe(0);
      expect(result.generatedServices.length).toBe(0);
      expect((fileSaver.generateContainer as any).calls.length).toBe(0);
    });

    it('should log verbose output if verbose is true', async () => {
      const options = {
        files: [],
        force: false,
        verbose: true, // Enable verbose
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );
      (fileSaver.getLockData as any).mockImplementation(() => []);
      mockFsExistsSync.mockReturnValue(false);

      // Mock dependencies
      (promptGenerator.generatePrompt as any).mockImplementation(() => 'prompt');
      (modelCaller.callOllamaModel as any).mockImplementation(() => Promise.resolve('raw response'));
      (codeCleaner.cleanGeneratedCode as any).mockImplementation(() => 'cleaned code');
      (postProcessor.postProcessGeneratedCode as any).mockImplementation(() => 'processed code');
      (postProcessor.validateGeneratedCode as any).mockImplementation(() => Promise.resolve({ isValid: true }));
      (fileAnalysis.getDependencies as any).mockImplementation(() => ({ constructorDeps: ['dep1'], propertyDeps: [{name: 'prop', type: 'type'}] }));
      (JSDocIndexer as any).mockImplementation(() => ({
        indexAllDependencies: () => Promise.resolve(),
        getIndexedLibraries: () => ['lib1'],
      }));
      mockFsReaddirSync.mockReturnValue([]);

      const result = await generateCode(options);

      expect(result.success).toBe(true);
      expect(mockConsoleLog.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle errors during generation', async () => {
      const options = {
        files: [],
        force: false,
        verbose: false,
        provider: 'ollama',
        model: 'llama3',
      };

      // Create a realistic mock declaration
      const testProject = new Project({ useInMemoryFileSystem: true });
      const sourceFile = testProject.createSourceFile(
        'src/IServiceA.ts',
        'export interface IServiceA { myMethod(): void; }'
      );
      const declaration = sourceFile.getInterfaceOrThrow('IServiceA');

      (fileAnalysis.analyzeSourceFiles as any).mockImplementation(() =>
        new Map([
          ['IServiceA', { declaration, sourceFile }],
        ])
      );
      (fileSaver.getLockData as any).mockImplementation(() => []);
      mockFsExistsSync.mockReturnValue(false);

      // Mock a dependency to throw an error
      (promptGenerator.generatePrompt as any).mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await generateCode(options);

      expect(result.success).toBe(false);
      expect(result.fileStats.length).toBe(1);
      expect(result.fileStats[0].status).toBe('error');
      expect(result.fileStats[0].error).toBe('Test error');
    });
  });
});