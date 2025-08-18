import { Project, InterfaceDeclaration, ClassDeclaration, Node, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { mock, fn } from 'bun:test'; // Import mock and fn from bun:test

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

// Mock external dependencies using Bun's mock.object
mock.object(fileAnalysis, {
  analyzeSourceFiles: fn(),
  getDependencies: fn(),
});
mock.object(promptGenerator, {
  generatePrompt: fn(),
});
mock.object(modelCaller, {
  callOllamaModel: fn(),
});
mock.object(codeCleaner, {
  cleanGeneratedCode: fn(),
});
mock.object(postProcessor, {
  postProcessGeneratedCode: fn(),
  validateGeneratedCode: fn(),
});
mock.object(fileSaver, {
  generateContainer: fn(),
  saveGeneratedFile: fn(),
  ensureOutputDirectory: fn(),
  getLockData: fn(),
});
mock.object(codeFixer, {
  fixGeneratedCode: fn(),
});
mock.object(config, {
  getConfig: fn(() => ({ outputDir: 'generated' })),
});

// Mock the JSDocIndexer class constructor and its methods
mock.fn(JSDocIndexer).mockImplementation(() => ({
  indexAllDependencies: fn(),
  getIndexedLibraries: fn(() => []),
}));


// Mock console.log and console.error to prevent clutter during tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('generator', () => {
  let project: Project;
  let mockFsExistsSync: jest.SpyInstance;
  let mockFsReaddirSync: jest.SpyInstance;
  let mockFsUnlinkSync: jest.SpyInstance;
  let mockProjectAddSourceFileAtPath: jest.SpyInstance;

  beforeEach(() => {
    project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        lib: ["es5", "dom"],
      },
    });

    // Reset mocks before each test
    // For Bun's mock.module, you might need to reset the mock implementations directly
    // or use mock.restore() if available. jest.clearAllMocks() might not work for Bun's mocks.
    // For now, we'll rely on mock.module's behavior.
    jest.clearAllMocks(); // Still useful for jest.spyOn

    // Mock fs functions
    mockFsExistsSync = jest.spyOn(fs, 'existsSync');
    mockFsReaddirSync = jest.spyOn(fs, 'readdirSync');
    mockFsUnlinkSync = jest.spyOn(fs, 'unlinkSync');

    // Mock project.addSourceFileAtPath
    mockProjectAddSourceFileAtPath = jest.spyOn(project, 'addSourceFileAtPath');
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
        interfaceName: 'ServiceB',
        implName: 'ServiceBImpl',
        implFilePath: './serviceb.service.impl.ts', // Path should be relative to outputDir
        constructorDependencies: ['DepType'],
        propertyDependencies: [],
      });
      expect(mockProjectAddSourceFileAtPath).toHaveBeenCalledTimes(2); // For servicea and serviceb
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
});