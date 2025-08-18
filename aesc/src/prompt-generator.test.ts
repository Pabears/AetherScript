import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { Project, InterfaceDeclaration, ClassDeclaration } from 'ts-morph'
import { generatePrompt, generateFixPrompt, extractThirdPartyLibraries } from './prompt-generator'
import { JSDocIndexer } from './jsdoc/indexer'

// Mock JSDocIndexer
mock.module('./jsdoc/indexer', () => ({
  JSDocIndexer: mock(() => ({
    loadLibraryJSDoc: mock((lib: string) => {
      if (lib === 'node-cache') {
        return { name: 'NodeCache', description: 'A cache library.', methods: [], properties: [], constructors: [] }
      }
      return null
    }),
  })),
}))

describe('prompt-generator', () => {
  let project: Project

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true })
  })

  describe('generatePrompt', () => {
    it('should generate a prompt for an interface with dependencies', () => {
      project.createSourceFile('/src/entity/user.ts', 'export class User {}')
      project.createSourceFile('/src/service/cache.ts', 'import NodeCache from "node-cache"; export interface ICache { set(key: string, value: any): void; }')
      const interfaceFile = project.createSourceFile(
        '/src/service/user-service.ts',
        `import { User } from '../entity/user';
         import { ICache } from './cache';
         export interface IUserService { getUser(id: string): User; }`,
      )
      const declaration = interfaceFile.getInterfaceOrThrow('IUserService')

      const prompt = generatePrompt(declaration, '/src/service/user-service.ts', '/generated/userservice.impl.ts')

      expect(prompt).toContain('implement the following interface')
      expect(prompt).toContain("The implementation class name must be 'IUserServiceImpl'")
      expect(prompt).toContain('// From: ../entity/user.ts\nexport class User {}')
      expect(prompt).toContain('import NodeCache from "node-cache"; export interface ICache { set(key: string, value: any): void; }')
      expect(prompt).toContain('interface you must implement')
      expect(prompt).toContain('export interface IUserService { getUser(id: string): User; }')
    })

    it('should generate a prompt for an abstract class', () => {
      const classFile = project.createSourceFile(
        '/src/service/base-service.ts',
        'export abstract class BaseService { abstract doSomething(): void; }',
      )
      const declaration = classFile.getClassOrThrow('BaseService')
      const prompt = generatePrompt(declaration, '/src/service/base-service.ts', '/generated/baseservice.impl.ts')
      expect(prompt).toContain('extend the following abstract class')
    })

    it('should throw an error for anonymous declaration', () => {
        const file = project.createSourceFile('test.ts', 'export default class {}');
        const declaration = file.getClasses()[0];
        expect(() => generatePrompt(declaration, 'test.ts', 'test.impl.ts')).toThrow();
    });
  })

  describe('generateFixPrompt', () => {
    it('should generate a prompt for fixing code', () => {
      const interfaceFile = project.createSourceFile(
        '/src/service/user-service.ts',
        'export interface IUserService { getUser(id: string): User; }',
      )
      const declaration = interfaceFile.getInterfaceOrThrow('IUserService')
      const currentCode = 'class IUserServiceImpl ...'
      const errors = ['Syntax error on line 1', 'Missing method implementation']

      const prompt = generateFixPrompt(declaration, '/src/service/user-service.ts', '/generated/userservice.impl.ts', currentCode, errors)

      expect(prompt).toContain('fix the following interface implementation')
      expect(prompt).toContain('Validation errors that must be fixed:')
      expect(prompt).toContain('- Syntax error on line 1')
      expect(prompt).toContain('- Missing method implementation')
      expect(prompt).toContain(currentCode)
    })

    it('should add a warning for truncated code', () => {
        const interfaceFile = project.createSourceFile(
            '/src/service/user-service.ts',
            'export interface IUserService { getUser(id: string): User; }',
        )
        const declaration = interfaceFile.getInterfaceOrThrow('IUserService');
        const truncatedCode = 'class IUserServiceImpl {'; // Missing closing brace
        const errors = ['Unexpected end of input'];

        const prompt = generateFixPrompt(declaration, '/src/service/user-service.ts', '/generated/userservice.impl.ts', truncatedCode, errors);

        expect(prompt).toContain('CRITICAL: The code appears incomplete/truncated.');
    });

    it('should throw an error for anonymous declaration in fix prompt', () => {
        const file = project.createSourceFile('test.ts', 'export default class {}');
        const declaration = file.getClasses()[0];
        expect(() => generateFixPrompt(declaration, 'test.ts', 'test.impl.ts', '', [])).toThrow();
    });
  })

  describe('extractThirdPartyLibraries', () => {
    it('should extract third party libraries from various import styles', () => {
        const code = `
            import MyDefaultLib from 'my-default-lib';
            import * as MyNamespace from 'my-namespace';
            import { NamedExport } from 'named-export-lib';

            new MyDefaultLib();
            new MyNamespace.Something();
            const x = new NamedExport();
        `;
        const libs = extractThirdPartyLibraries(code);
        expect(libs).toEqual(expect.arrayContaining([
            { className: 'MyDefaultLib', packageName: 'my-default-lib' },
            { className: 'MyNamespace', packageName: 'my-namespace' },
            { className: 'NamedExport', packageName: 'named-export-lib' },
        ]));
    });
  })
})
