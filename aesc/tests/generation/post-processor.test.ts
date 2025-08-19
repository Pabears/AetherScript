import { describe, it, expect, beforeEach } from 'bun:test'
import { Project, InterfaceDeclaration, ClassDeclaration } from 'ts-morph'
import { postProcessGeneratedCode, validateGeneratedCode } from '../../src/generation/post-processor'
import * as path from 'path'

describe('post-processor', () => {
  let project: Project

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true, compilerOptions: { strict: true } })
  })

  describe('postProcessGeneratedCode', () => {
    it('should replace implements with extends for abstract classes', () => {
      const abstractClassFile = project.createSourceFile(
        '/src/base.ts',
        'export abstract class Base { abstract a: string; }',
      )
      const declaration = abstractClassFile.getClassOrThrow('Base')
      const generatedCode = 'class BaseImpl implements Base { a = "hello"; }'
      const result = postProcessGeneratedCode(
        generatedCode,
        declaration,
        '/generated/base.impl.ts',
      )
      expect(result).toContain('class BaseImpl extends Base')
      expect(result).not.toContain('implements Base')
    })

    it('should preserve and adjust imports from original file', () => {
        project.createSourceFile('/src/entity/customer.ts', 'export class Customer {}');
        const originalFile = project.createSourceFile(
            '/src/service/customer-service.ts',
            `import { Customer } from '../entity/customer';\nexport interface ICustomerService {}`
        );
        const declaration = originalFile.getInterfaceOrThrow('ICustomerService');
        const generatedCode = `export class ICustomerServiceImpl implements ICustomerService {}`;
        const generatedFilePath = '/src/generated/customerservice.service.impl.ts';

        const result = postProcessGeneratedCode(generatedCode, declaration, generatedFilePath);

        const expectedImportPath = '../entity/customer';
        expect(result).toContain(`import { Customer } from "${expectedImportPath}";`);
    });


    it('should add new imports for types used in implementation', () => {
      project.createSourceFile('/src/entity/customer.ts', 'export class Customer {}')
      const interfaceFile = project.createSourceFile(
        '/src/service.ts',
        'export interface IService {}',
      )
      const declaration = interfaceFile.getInterfaceOrThrow('IService')
      const generatedCode =
        'class IServiceImpl implements IService { constructor(private customer: Customer) {} }'

      const result = postProcessGeneratedCode(
        generatedCode,
        declaration,
        '/generated/service.impl.ts',
      )
      expect(result).toContain(`import { Customer } from "../src/entity/customer";`)
    })
  })

  describe('validateGeneratedCode', () => {
    it('should return valid for correct code', async () => {
      project.createSourceFile(
        '/src/service.ts',
        'export interface IService { myMethod(): string; }',
      )
      const declaration = project.getSourceFileOrThrow('/src/service.ts').getInterfaceOrThrow('IService')
      const validCode =
        `import { IService } from "../src/service";\n` +
        'export class IServiceImpl implements IService { myMethod() { return "hello"; } }'
      const result = await validateGeneratedCode(
        validCode,
        declaration,
        '/generated/service.impl.ts',
      )
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should return invalid for incorrect code', async () => {
      project.createSourceFile(
        '/src/service.ts',
        'export interface IService { myMethod(): string; }',
      )
      const declaration = project.getSourceFileOrThrow('/src/service.ts').getInterfaceOrThrow('IService')
      const invalidCode =
        `import { IService } from "../src/service";\n` +
        'export class IServiceImpl implements IService { myMethod() {} }'
      const result = await validateGeneratedCode(
        invalidCode,
        declaration,
        '/generated/service.impl.ts',
      )
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain("is not assignable to type '() => string'")
    })
  })
})
