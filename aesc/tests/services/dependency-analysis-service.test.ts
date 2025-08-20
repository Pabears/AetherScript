import { describe, test, expect, beforeEach } from 'bun:test';
import { DependencyAnalysisServiceImpl } from '../../src/generated/dependency-analysis.service.impl';
import { JSDocServiceImpl } from '../../src/generated/jsdoc.service.impl';
import type { JSDocService } from '../../src/services/jsdoc-service';
import { Project } from 'ts-morph';
import * as path from 'path';

describe('DependencyAnalysisService', () => {
    let service: DependencyAnalysisServiceImpl;
    let project: Project;
    const testProjectPath = path.resolve(process.cwd(), '../aesc_tests/jsdoc_service_test');
    let jsdocService: JSDocService;

    beforeEach(() => {
        // The JSDocService needs a real path to find the test project's cache
        jsdocService = new JSDocServiceImpl(testProjectPath);
        service = new DependencyAnalysisServiceImpl(jsdocService);
        project = new Project({ useInMemoryFileSystem: true });
    });

    test('generateDependencyInfo should include internal and external dependencies', async () => {
        // Internal dependency
        project.createSourceFile(
            'src/internal-service.ts',
            `export class InternalService { public doSomething() {} }`
        );

        // The main service that has dependencies
        const mainServiceFile = project.createSourceFile(
            'src/main-service.ts',
            `
            import { InternalService } from './internal-service';
            import NodeCache from 'node-cache';

            export abstract class MainService {
                protected internal: InternalService;
                protected cache: NodeCache;

                abstract run(): void;
            }
            `
        );

        const mainServiceDecl = mainServiceFile.getClass('MainService');
        expect(mainServiceDecl).toBeDefined();

        const generatedFilePath = path.join(testProjectPath, 'src/generated/main.service.impl.ts');

        const { dependenciesText, originalCode } = await service.generateDependencyInfo(
            mainServiceDecl!,
            'src/main-service.ts', // Use a more specific path
            generatedFilePath
        );

        // Check for original code (now using full file text)
        expect(originalCode).toContain('import NodeCache from \'node-cache\';');

        // Check for internal dependency source code - we check for the code itself, not the fragile path comment.
        expect(dependenciesText).toContain('export class InternalService { public doSomething() {} }');
        
        // Check for external dependency JSDoc (this should work now)
        expect(dependenciesText).toContain('// External dependency: external: node-cache');
        expect(dependenciesText).toContain('class node-cache');
    });
});
