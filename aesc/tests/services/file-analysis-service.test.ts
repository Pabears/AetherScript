import { describe, test, expect, beforeEach } from 'bun:test';
import { FileAnalysisServiceImpl } from '../../src/generated/file-analysis.service.impl';
import { Project, ClassDeclaration } from 'ts-morph';

describe('FileAnalysisService', () => {
    let service: FileAnalysisServiceImpl;
    let project: Project;

    beforeEach(() => {
        service = new FileAnalysisServiceImpl();
        project = new Project({ useInMemoryFileSystem: true });
        // Add decorator definition inside a `src` directory to be found by the service
        project.createSourceFile('src/decorators.ts', 'export function AutoGen(target: any, key: any) {}');
    });

    test('getDependencies should extract constructor and property dependencies', () => {
        const sourceFile = project.createSourceFile(
            'src/test.ts',
            `
            import { AutoGen } from './decorators';
            
            abstract class DbService {}
            class SomeOtherClass {}

            class TestClass {
                @AutoGen
                private db: DbService;

                constructor(private someOtherService: SomeOtherClass) {}
            }
            `
        );

        const classDecl = sourceFile.getClass('TestClass');
        expect(classDecl).toBeDefined();

        const { constructorDeps, propertyDeps } = service.getDependencies(classDecl!);
        
        expect(constructorDeps.length).toBe(1);
        expect(constructorDeps[0]).toBe('SomeOtherClass');

        expect(propertyDeps.length).toBe(1);
        expect(propertyDeps[0].name).toBe('db');
        expect(propertyDeps[0].type).toBe('DbService');
    });

    test('analyzeSourceFiles should find services with @AutoGen decorator', () => {
        project.createSourceFile(
            'src/services/user-service.ts',
            `
            export abstract class UserService {
                abstract getUser(id: string): void;
            }
            `
        );
        
        project.createSourceFile(
            'src/controllers/user-controller.ts',
            `
            import { AutoGen } from '../decorators';
            import { UserService } from '../services/user-service';

            export class UserController {
                @AutoGen
                private userService: UserService;
            }
            `
        );

        const servicesToGenerate = service.analyzeSourceFiles(project, []);
        
        expect(servicesToGenerate.size).toBe(1);
        expect(servicesToGenerate.has('UserService')).toBe(true);
        
        const userServiceDecl = servicesToGenerate.get('UserService');
        expect(userServiceDecl).toBeDefined();
        expect(userServiceDecl!.declaration.getName()).toBe('UserService');
    });

    test('analyzeSourceFiles should return empty map if no decorators are found', () => {
        project.createSourceFile('src/test.ts', 'class MyClass {}');
        const servicesToGenerate = service.analyzeSourceFiles(project, []);
        expect(servicesToGenerate.size).toBe(0);
    });
});
