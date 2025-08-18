import { Project, ClassDeclaration, SourceFile } from 'ts-morph';
import { getDependencies, analyzeSourceFiles, PropertyDependency } from './file-analysis';
import * as path from 'path';

// Dummy AutoGen decorator for testing purposes
function AutoGen() {
  return (target: any, propertyKey: string) => {};
}

describe('file-analysis', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        lib: ["es5", "dom"], // Added this
      },
    });
  });

  describe('getDependencies', () => {
    it('should correctly extract constructor and AutoGen property dependencies', () => {
      const sourceFile = project.createSourceFile('src/test.ts', ` // Changed path to src/
        import { AutoGen } from './decorators'; // Mocking AutoGen import

        interface DependencyA {}
        interface DependencyB {}
        interface DependencyC {}

        class MyService {
          constructor(private depA: DependencyA, public depB: DependencyB) {}

          @AutoGen()
          myProp1: DependencyC;

          myProp2: string; // Should be ignored
        }
      `);

      const myServiceClass = sourceFile.getClassOrThrow('MyService');
      const { constructorDeps, propertyDeps } = getDependencies(myServiceClass);

      expect(constructorDeps).toEqual(['DependencyA', 'DependencyB']);
      expect(propertyDeps).toEqual([{ name: 'myProp1', type: 'DependencyC' }]);
    });

    it('should handle classes with no constructor or no AutoGen properties', () => {
      const sourceFile = project.createSourceFile('src/test2.ts', ` // Changed path to src/
        class AnotherService {
          someField: string;
        }
      `);

      const anotherServiceClass = sourceFile.getClassOrThrow('AnotherService');
      const { constructorDeps, propertyDeps } = getDependencies(anotherServiceClass);

      expect(constructorDeps).toEqual([]);
      expect(propertyDeps).toEqual([]);
    });

    it('should handle union types for AutoGen properties', () => {
      const sourceFile = project.createSourceFile('src/test3.ts', ` // Changed path to src/
        import { AutoGen } from './decorators';

        interface DependencyD {}

        class UnionService {
          @AutoGen()
          myUnionProp: DependencyD | undefined;
        }
      `);

      const unionServiceClass = sourceFile.getClassOrThrow('UnionService');
      const { constructorDeps, propertyDeps } = getDependencies(unionServiceClass);

      expect(constructorDeps).toEqual([]);
      expect(propertyDeps).toEqual([{ name: 'myUnionProp', type: 'DependencyD' }]);
    });
  });

  describe('analyzeSourceFiles', () => {
    it('should identify services with AutoGen properties across multiple files', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: any, propertyKey: string) => {}; }`); // Changed path to src/
      const file1 = project.createSourceFile('src/serviceA.ts', ` // Changed path to src/
        import { AutoGen } from './decorators';
        interface IServiceA {}
        class ServiceAImpl implements IServiceA {
          @AutoGen()
          dep: IServiceB;
        }
      `);
      const file2 = project.createSourceFile('src/serviceB.ts', ` // Changed path to src/
        interface IServiceB {}
        abstract class ServiceBBase implements IServiceB {}
      `);
      const file3 = project.createSourceFile('src/serviceC.ts', ` // Changed path to src/
        interface IServiceC {}
        class ServiceCImpl implements IServiceC {
          constructor(private serviceA: IServiceA) {}
        }
      `);

      const servicesToGenerate = analyzeSourceFiles(project, []);
      
      expect(servicesToGenerate.size).toBe(1);
      expect(servicesToGenerate.has('ServiceBBase')).toBe(true); // Changed from 'IServiceB' to 'ServiceBBase'
      const serviceBEntry = servicesToGenerate.get('ServiceBBase'); // Changed from 'IServiceB' to 'ServiceBBase'
      expect(serviceBEntry?.declaration.getName()).toBe('ServiceBBase');
      expect(serviceBEntry?.sourceFile.getFilePath()).toContain('src/serviceB.ts');
    });

    it('should filter files if a file list is provided', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: any, propertyKey: string) => {}; }`); // Changed path to src/
      const file1 = project.createSourceFile('src/serviceX.ts', ` // Changed path to src/
        import { AutoGen } from './decorators';
        interface IX {}
        class XImpl implements IX {
          @AutoGen()
          dep: IY;
        }
      `);
      const file2 = project.createSourceFile('src/serviceY.ts', ` // Changed path to src/
        interface IY {}
        abstract class YBase implements IY {}
      `);
      const file3 = project.createSourceFile('src/serviceZ.ts', ` // Changed path to src/
        import { AutoGen } from './decorators';
        interface IZ {}
        class ZImpl implements IZ {
          @AutoGen()
          dep: IW;
        }
      `);
      const file4 = project.createSourceFile('src/serviceW.ts', ` // Changed path to src/
        interface IW {}
        abstract class WBase implements IW {} 
      `);

      const servicesToGenerate = analyzeSourceFiles(project, ['servicex.ts', 'servicew.ts']); // Filenames remain the same for filtering

      expect(servicesToGenerate.size).toBe(1);
      expect(servicesToGenerate.has('YBase')).toBe(true); // Changed from 'IY' to 'YBase'
      const serviceYEntry = servicesToGenerate.get('YBase'); // Changed from 'IY' to 'YBase'
      expect(serviceYEntry?.declaration.getName()).toBe('YBase');
      expect(serviceYEntry?.sourceFile.getFilePath()).toContain('src/serviceY.ts');
    });

    it('should handle cases where AutoGen type cannot be resolved or is not an interface/abstract class', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: any, propertyKey: string) => {}; }`); // Changed path to src/
      const file1 = project.createSourceFile('src/invalidService.ts', ` // Changed path to src/
        import { AutoGen } from './decorators';
        class InvalidService {
          @AutoGen()
          dep: string; // Primitive type, should be ignored/error
        }
      `);
      const file2 = project.createSourceFile('src/anotherInvalidService.ts', ` // Changed path to src/
        import { AutoGen } from './decorators';
        class AnotherInvalidService {
          @AutoGen()
          dep: NotAValidType; // Unresolved type (should hit !typeSymbol)
        }
      `);
      const file3 = project.createSourceFile('src/undefinedUnion.ts', ` // New file for undefined union
        import { AutoGen } from './decorators';
        class UndefinedUnionService {
          @AutoGen()
          dep: undefined | undefined; // Union of only undefined types (should hit !targetType)
        }
      `);

      // Temporarily reassign console.error for mocking
      const originalConsoleError = console.error;
      let errorCalls = 0;
      console.error = (...args: any[]) => {
        errorCalls++;
        // Optionally log for debugging: originalConsoleError(...args);
      };

      const servicesToGenerate = analyzeSourceFiles(project, []);
      
      expect(servicesToGenerate.size).toBe(0);
      expect(errorCalls).toBe(3); // Expecting errors for invalidService, anotherInvalidService, and undefinedUnion

      // Restore original console.error
      console.error = originalConsoleError;
    });

    it('should log an error if an AutoGen interface has no abstract class implementation', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: any, propertyKey: string) => {}; }`);
      project.createSourceFile('src/noImplInterface.ts', `
        import { AutoGen } from './decorators';
        interface IMyInterface {} // No abstract class implements this
        class ServiceUsingInterface {
          @AutoGen()
          dep: IMyInterface;
        }
      `);

      const originalConsoleError = console.error;
      let errorCalls = 0;
      console.error = (...args: any[]) => {
        errorCalls++;
      };

      analyzeSourceFiles(project, []);
      expect(errorCalls).toBe(1);
      console.error = originalConsoleError;
    });
  });
});
