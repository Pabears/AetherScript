import { Project } from 'ts-morph';
import { getDependencies, analyzeSourceFiles } from '../src/file-analysis';
import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';

// Dummy AutoGen decorator for testing purposes
function AutoGen() {
  return (target: object, propertyKey: string) => {};
}

describe('file-analysis', () => {
  let project: Project;
  const spies: { mockRestore: () => void }[] = [];

  beforeEach(() => {
    project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        lib: ["es5", "dom"],
      },
    });
  });

  afterEach(() => {
    spies.forEach(s => s.mockRestore());
    spies.length = 0;
  });

  describe('getDependencies', () => {
    it('should correctly extract constructor and AutoGen property dependencies', () => {
      const sourceFile = project.createSourceFile('src/test.ts', `
        interface DependencyA {}
        interface DependencyB {}
        interface DependencyC {}

        class MyService {
          constructor(private depA: DependencyA, public depB: DependencyB) {}

          @AutoGen()
          myProp1: DependencyC;

          myProp2: string;
        }
      `);

      const myServiceClass = sourceFile.getClassOrThrow('MyService');
      const { constructorDeps, propertyDeps } = getDependencies(myServiceClass);

      expect(constructorDeps).toEqual(['DependencyA', 'DependencyB']);
      expect(propertyDeps).toEqual([{ name: 'myProp1', type: 'DependencyC' }]);
    });

    it('should handle classes with no constructor or no AutoGen properties', () => {
      const sourceFile = project.createSourceFile('src/test2.ts', `
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
      const sourceFile = project.createSourceFile('src/test3.ts', `
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
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: object, propertyKey: string) => {}; }`);
      project.createSourceFile('src/serviceA.ts', `
        import { AutoGen } from './decorators';
        interface IServiceA {}
        class ServiceAImpl implements IServiceA {
          @AutoGen()
          dep: IServiceB;
        }
      `);
      project.createSourceFile('src/serviceB.ts', `
        interface IServiceB {}
        abstract class ServiceBBase implements IServiceB {}
      `);
      project.createSourceFile('src/serviceC.ts', `
        interface IServiceC {}
        class ServiceCImpl implements IServiceC {
          constructor(private serviceA: IServiceA) {}
        }
      `);

      const logMessages: string[] = [];
      const logSpy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        logMessages.push(args.join(' '));
      });
      spies.push(logSpy);

      const servicesToGenerate = analyzeSourceFiles(project, []);
      
      expect(servicesToGenerate.size).toBe(1);
      expect(servicesToGenerate.has('ServiceBBase')).toBe(true);
      const serviceBEntry = servicesToGenerate.get('ServiceBBase');
      expect(serviceBEntry?.declaration.getName()).toBe('ServiceBBase');
      expect(serviceBEntry?.sourceFile.getFilePath()).toContain('src/serviceB.ts');

      expect(logSpy).toHaveBeenCalled();
      expect(logMessages[0]).toContain('Found @AutoGen on ServiceAImpl.dep');
    });

    it('should filter files if a file list is provided', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: object, propertyKey: string) => {}; }`);
      project.createSourceFile('src/serviceX.ts', `
        import { AutoGen } from './decorators';
        interface IX {}
        class XImpl implements IX {
          @AutoGen()
          dep: IY;
        }
      `);
      project.createSourceFile('src/serviceY.ts', `
        interface IY {}
        abstract class YBase implements IY {}
      `);
      project.createSourceFile('src/serviceZ.ts', `
        import { AutoGen } from './decorators';
        interface IZ {}
        class ZImpl implements IZ {
          @AutoGen()
          dep: IW;
        }
      `);
      project.createSourceFile('src/serviceW.ts', `
        interface IW {}
        abstract class WBase implements IW {} 
      `);

      const servicesToGenerate = analyzeSourceFiles(project, ['servicex.ts', 'servicew.ts']);

      expect(servicesToGenerate.size).toBe(1);
      expect(servicesToGenerate.has('YBase')).toBe(true);
      const serviceYEntry = servicesToGenerate.get('YBase');
      expect(serviceYEntry?.declaration.getName()).toBe('YBase');
      expect(serviceYEntry?.sourceFile.getFilePath()).toContain('src/serviceY.ts');
    });

    it('should handle cases where AutoGen type cannot be resolved or is not an interface/abstract class', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: object, propertyKey: string) => {}; }`);
      project.createSourceFile('src/invalidService.ts', `
        import { AutoGen } from './decorators';
        class InvalidService {
          @AutoGen()
          dep: string;
        }
      `);
      project.createSourceFile('src/anotherInvalidService.ts', `
        import { AutoGen } from './decorators';
        class AnotherInvalidService {
          @AutoGen()
          dep: NotAValidType;
        }
      `);
      project.createSourceFile('src/undefinedUnion.ts', `
        import { AutoGen } from './decorators';
        class UndefinedUnionService {
          @AutoGen()
          dep: undefined | undefined;
        }
      `);

      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      spies.push(errorSpy);

      const servicesToGenerate = analyzeSourceFiles(project, []);
      
      expect(servicesToGenerate.size).toBe(0);
      expect(errorSpy).toHaveBeenCalledTimes(3);
    });

    it('should log an error if an AutoGen interface has no abstract class implementation', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: object, propertyKey: string) => {}; }`);
      project.createSourceFile('src/noImplInterface.ts', `
        import { AutoGen } from './decorators';
        interface IMyInterface {}
        class ServiceUsingInterface {
          @AutoGen()
          dep: IMyInterface;
        }
      `);

      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      spies.push(errorSpy);

      analyzeSourceFiles(project, []);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle unresolvable type symbols', () => {
      project.createSourceFile('src/decorators.ts', `export function AutoGen() { return (target: object, propertyKey: string) => {}; }`);
      project.createSourceFile('src/unresolvable.ts', `
        import { AutoGen } from './decorators';
        class UnresolvableService {
          @AutoGen()
          dep: UnresolvableType;
        }
      `);

      const errorMessages: string[] = [];
      const errorSpy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        errorMessages.push(args.join(' '));
      });
      spies.push(errorSpy);

      analyzeSourceFiles(project, []);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorMessages[0]).toContain('Error: Could not find symbol for type UnresolvableType');
    });
  });
});
