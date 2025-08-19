import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { JSDocExtractor, type JSDocInfo } from '../../src/jsdoc/extractor';
import { Project } from 'ts-morph';

// Mock fs for JSDocIndexer, but not for ts-morph inside JSDocExtractor
const memoryFS: { [key: string]: any } = {};
mock.module('fs', () => ({
  existsSync: (p: string) => memoryFS.hasOwnProperty(p),
  mkdirSync: (p: string, options: any) => (memoryFS[p] = 'directory'),
  readFileSync: (p: string, encoding: string) => {
    if (memoryFS[p]) return memoryFS[p];
    const error: any = new Error(`ENOENT: no such file or directory, open '${p}'`);
    error.code = 'ENOENT';
    throw error;
  },
  writeFileSync: (p: string, data: string) => (memoryFS[p] = data),
  readdirSync: (p: string) => [],
  unlinkSync: (p: string) => delete memoryFS[p],
  statSync: (p: string) => ({ isDirectory: () => memoryFS[p] === 'directory' }),
}));


describe('JSDocExtractor', () => {
  const projectPath = '/test-project';
  let extractor: JSDocExtractor;
  let testProject: Project;
  const spies: { mockRestore: () => void }[] = [];

  beforeEach(() => {
    for (const key in memoryFS) {
      delete memoryFS[key];
    }

    testProject = new Project({ useInMemoryFileSystem: true });
    extractor = new JSDocExtractor(projectPath, testProject);

    // Also need to mock the fs calls made by the extractor itself for caching
    spies.push(spyOn(fs, 'existsSync').mockImplementation((p) => memoryFS.hasOwnProperty(p.toString())));
    spies.push(spyOn(fs, 'mkdirSync').mockImplementation((p) => (memoryFS[p.toString()] = 'directory')));
    spies.push(spyOn(fs, 'readFileSync').mockImplementation((p) => memoryFS[p.toString()]));
    spies.push(spyOn(fs, 'writeFileSync').mockImplementation((p, data) => (memoryFS[p.toString()] = data.toString())));
  });

  afterEach(() => {
    spies.forEach(s => s.mockRestore());
    spies.length = 0;
  });


  it('should return from cache if available', () => {
    const libName = 'my-lib';
    const cachedPath = path.join(projectPath, '.jsdoc', `${libName}.json`);
    const cachedData: JSDocInfo = { name: 'my-lib', description: 'cached', methods: [], properties: [], constructors: [] };
    memoryFS[cachedPath] = JSON.stringify(cachedData);

    const result = extractor.extractLibraryJSDoc(libName);
    expect(result).toEqual(cachedData);
  });

  it('should return null if no type definition files are found', () => {
    spies.push(spyOn(extractor as any, 'findTypeDefinitionFiles').mockReturnValue([]));
    const result = extractor.extractLibraryJSDoc('non-existent-lib');
    expect(result).toBeNull();
  });

  it('should extract JSDoc from a class', () => {
    const libName = 'class-lib';
    testProject.createSourceFile(`/test-project/node_modules/${libName}/index.d.ts`, `
      /**
       * This is a test class.
       */
      export class TestClass {
        /**
         * A sample property.
         */
        public myProp: string;

        /**
         * Creates an instance of TestClass.
         * @param initialValue The initial value for myProp.
         */
        constructor(initialValue: string) {}

        /**
         * A sample method.
         * @param a A number.
         * @param b A string.
         * @returns The result.
         */
        myMethod(a: number, b: string): boolean { return true; }
      }
    `);

    spies.push(spyOn(extractor as any, 'findTypeDefinitionFiles').mockReturnValue([`/test-project/node_modules/${libName}/index.d.ts`]));

    const result = extractor.extractLibraryJSDoc(libName);
    expect(result).toBeDefined();
    expect(result!.description.trim()).toBe('This is a test class.');
    expect(result!.properties[0].name).toBe('myProp');
    expect(result!.constructors[0].parameters[0].name).toBe('initialValue');
    expect(result!.methods[0].name).toBe('myMethod');
  });

  it('should extract JSDoc from an interface', () => {
    const libName = 'interface-lib';
    testProject.createSourceFile(`/test-project/node_modules/${libName}/index.d.ts`, `
      /**
       * This is a test interface.
       */
      export interface ITest {
        /**
         * A sample property.
         */
        myProp: string;

        /**
         * A sample method.
         * @param a A number.
         */
        myMethod(a: number): void;
      }
    `);

    spies.push(spyOn(extractor as any, 'findTypeDefinitionFiles').mockReturnValue([`/test-project/node_modules/${libName}/index.d.ts`]));

    const result = extractor.extractLibraryJSDoc(libName);
    expect(result).toBeDefined();
    expect(result!.description.trim()).toBe('This is a test interface.');
    expect(result!.properties).toHaveLength(1);
    expect(result!.properties[0].name).toBe('myProp');
    expect(result!.methods).toHaveLength(1);
    expect(result!.methods[0].name).toBe('myMethod');
  });

  it('should extract JSDoc from a type alias', () => {
    const libName = 'type-alias-lib';
    testProject.createSourceFile(`/test-project/node_modules/${libName}/index.d.ts`, `
      /**
       * A useful type alias.
       */
      export type MyType = string | number;
    `);

    spies.push(spyOn(extractor as any, 'findTypeDefinitionFiles').mockReturnValue([`/test-project/node_modules/${libName}/index.d.ts`]));

    const result = extractor.extractLibraryJSDoc(libName);
    expect(result).toBeDefined();
    expect(result!.properties).toHaveLength(1);
    expect(result!.properties[0].name).toBe('MyType');
  });
});
