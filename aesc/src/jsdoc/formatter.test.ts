import { describe, it, expect } from 'bun:test'
import { JSDocFormatter } from './formatter'
import type { JSDocInfo } from './extractor'

describe('JSDocFormatter', () => {
  const formatter = new JSDocFormatter()
  const sampleJSDoc: JSDocInfo = {
    name: 'MyLibrary',
    description: 'A sample library.',
    constructors: [
      {
        signature: 'constructor(config: object)',
        description: 'Creates an instance.',
        parameters: [{ name: 'config', type: 'object', description: 'The config.' }],
      },
    ],
    properties: [
      { name: 'myProp', type: 'string', description: 'A property.' },
    ],
    methods: [
      {
        name: 'myMethod',
        signature: 'myMethod(a: number): string',
        description: 'A method.',
        parameters: [{ name: 'a', type: 'number', description: 'A number.' }],
        returnType: 'string',
        returnDescription: 'A string.',
      },
      {
        name: 'asyncMethod',
        signature: 'asyncMethod(): Promise<void>',
        description: 'An async method.',
        parameters: [],
        returnType: 'Promise<void>',
        returnDescription: 'A promise.',
      }
    ],
  }

  describe('formatForLLM', () => {
    it('should format a full JSDocInfo object correctly', () => {
      const result = formatter.formatForLLM(sampleJSDoc)
      expect(result).toContain('// External dependency: MyLibrary')
      expect(result).toContain('// A sample library.')
      expect(result).toContain('class MyLibrary {')
      expect(result).toContain('/**\n     * Creates an instance.')
      expect(result).toContain('constructor(config: object);')
      expect(result).toContain('/** A property. */')
      expect(result).toContain('myProp: string;')
      expect(result).toContain('/**\n     * A method.')
      expect(result).toContain('myMethod(a: number): string;')
      expect(result).toContain('}')
    })

    it('should handle missing descriptions and parameters', () => {
        const simpleDoc: JSDocInfo = { name: 'Simple', description: '', constructors: [], properties: [], methods: [] };
        const result = formatter.formatForLLM(simpleDoc);
        expect(result).toBe('// External dependency: Simple\nclass Simple {\n    constructor();\n}')
    });
  })

  describe('simplifyType', () => {
    it('should simplify complex types', () => {
        const simplified = (formatter as any).simplifyType('import("module").Namespace.Type<string>');
        expect(simplified).toBe('Type<string>');
    });

    it('should simplify optional types', () => {
        const simplified = (formatter as any).simplifyType('string | undefined');
        expect(simplified).toBe('string?');
    });

    it('should simplify long types to any', () => {
        const longType = 'a'.repeat(100);
        const simplified = (formatter as any).simplifyType(longType);
        expect(simplified).toBe('any');
    });
  });

  describe('generateUsageExample', () => {
    it('should generate a usage example', () => {
        const result = formatter.generateUsageExample(sampleJSDoc);
        expect(result).toContain('// Usage example for MyLibrary:')
        expect(result).toContain('const instance = new MyLibrary({});')
        expect(result).toContain('const result = instance.myMethod(123);')
    })

    it('should generate an async usage example', () => {
        const asyncDoc: JSDocInfo = { ...sampleJSDoc, methods: [sampleJSDoc.methods[1]] };
        const result = formatter.generateUsageExample(asyncDoc);
        expect(result).toContain('const result = await instance.asyncMethod();')
    })

    it('should generate usage example with object and undefined params', () => {
        const doc: JSDocInfo = {
            name: 'MyLibrary',
            description: '',
            constructors: [
                {
                    signature: 'constructor(a: object, b: SomeType)',
                    description: '',
                    parameters: [
                        { name: 'a', type: 'object', description: '' },
                        { name: 'b', type: 'SomeType', description: '' },
                    ],
                },
            ],
            properties: [],
            methods: [],
        };
        const result = formatter.generateUsageExample(doc);
        expect(result).toContain('const instance = new MyLibrary({}, undefined);');
    });

    it('should generate usage example with boolean param', () => {
        const doc: JSDocInfo = {
            name: 'MyLibrary',
            description: '',
            constructors: [],
            properties: [],
            methods: [
                {
                    name: 'myMethod',
                    signature: 'myMethod(a: boolean): void',
                    description: '',
                    parameters: [{ name: 'a', type: 'boolean', description: '' }],
                    returnType: 'void',
                    returnDescription: '',
                },
            ],
        };
        const result = formatter.generateUsageExample(doc);
        expect(result).toContain('const result = instance.myMethod(true);');
    });
  })
})
