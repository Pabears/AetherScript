import { test, expect, describe, beforeAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { Project, ClassDeclaration } from 'ts-morph';
import { getDependencies, generateContainer } from '../aesc';
import type { GeneratedService } from '../aesc';

describe('getDependencies', () => {
    const project = new Project({ useInMemoryFileSystem: true });

    test('should NOT find dependency if @AutoGen decorator is missing', () => {
        const sourceFile = project.createSourceFile(
            'test.ts',
            `
            interface DB {}
            abstract class UserService {
                db?: DB;
            }
            class UserServiceImpl extends UserService {}
            `
        );

        const userServiceImplClass = sourceFile.getClass('UserServiceImpl')!;
        const { propertyDeps } = getDependencies(userServiceImplClass);

        expect(propertyDeps.length).toBe(0);
    });

    test('should find dependency if @AutoGen decorator is present', () => {
        // Add a decorator function to the global scope for the test
        project.createSourceFile(
            'decorators.ts',
            `export function AutoGen(target: any, propertyKey: string) {}`
        );

        const sourceFile = project.createSourceFile(
            'testWithDecorator.ts',
            `
            import { AutoGen } from './decorators';
            interface DB {}
            abstract class UserService {
                @AutoGen
                db?: DB;
            }
            class UserServiceImpl extends UserService {}
            `
        );

        const userServiceImplClass = sourceFile.getClass('UserServiceImpl')!;
        const { propertyDeps } = getDependencies(userServiceImplClass);

        expect(propertyDeps.length).toBe(1);
        expect(propertyDeps[0].name).toBe('db');
        expect(propertyDeps[0].type).toBe('DB');
    });
});

describe('getDependencies with inheritance from user.ts', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    let userFileContent: string;

    beforeAll(() => {
        // Load the real content of user.ts
        userFileContent = fs.readFileSync(path.resolve(__dirname, '../src/user.ts'), 'utf-8');
    });

    test('should find inherited dependency from UserService', () => {
        // Create the user.ts file in the virtual file system
        project.createSourceFile('src/user.ts', userFileContent);

        // Create a dummy implementation class that extends UserService
        const implSourceFile = project.createSourceFile(
            'src/userservice.service.impl.ts',
            `
            import { UserService, User } from './user';

            export class UserServiceImpl extends UserService {
                create(user: User): void {}
                findByName(name: string): User | undefined { return undefined; }
            }
            `
        );

        const userServiceImplClass = implSourceFile.getClass('UserServiceImpl')!;
        const { propertyDeps } = getDependencies(userServiceImplClass);

        expect(propertyDeps.length).toBe(1);
        expect(propertyDeps[0].name).toBe('db');
        // The type might be more complex, let's check if it contains 'DB'
                expect(propertyDeps[0].type).toContain('DB');
    });
});

describe('generateContainer', () => {
    const outputDir = path.resolve(__dirname, 'generated_test');

    beforeAll(() => {
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
        fs.mkdirSync(outputDir, { recursive: true });
    });

    test('should generate container with correct dependency injection', async () => {
        const services: GeneratedService[] = [
            {
                interfaceName: 'DB',
                implName: 'DBImpl',
                implFilePath: './db.service.impl',
                constructorDependencies: [],
                propertyDependencies: [],
            },
            {
                interfaceName: 'UserService',
                implName: 'UserServiceImpl',
                implFilePath: './userservice.service.impl',
                constructorDependencies: [],
                propertyDependencies: [{ name: 'db', type: 'DB' }],
            },
        ];

        await generateContainer(outputDir, services);

        const containerContent = fs.readFileSync(path.join(outputDir, 'container.ts'), 'utf-8');

        // This is the crucial check. We expect the generated code to inject the 'DB' service.
        const expectedInjectionCode = `instance.db = this.get('DB');`;

        // For now, this test will fail, which is what we want.
        // We will make it pass in the next step.
        expect(containerContent).toContain(expectedInjectionCode);
    });
});
