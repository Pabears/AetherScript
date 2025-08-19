import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { Project, InterfaceDeclaration, ClassDeclaration } from 'ts-morph'
import { generatePrompt, generateFixPrompt, extractThirdPartyLibraries } from './prompt-generator'
import { JSDocIndexer } from './jsdoc/indexer'

// Mock the JSDocIndexer
mock.module('./jsdoc/indexer', () => {
    return {
        JSDocIndexer: class {
            loadLibraryJSDoc() {
                return null;
            }
        },
    };
});

describe('prompt-generator', () => {
    let project: Project;

    beforeEach(() => {
        project = new Project({ useInMemoryFileSystem: true });
    });

    describe('generatePrompt', () => {
        it('should generate a prompt for a simple interface', () => {
            const sourceFile = project.createSourceFile(
                'src/services/user-service.ts',
                'export interface UserService { createUser(name: string): void; }'
            );
            const declaration = sourceFile.getInterface('UserService')!;
            const prompt = generatePrompt(declaration, sourceFile.getFilePath(), '/app/aesc/src/generated/userservice.service.impl.ts');

            expect(prompt).toContain('Your task is to implement the following interface');
            expect(prompt).toContain("The implementation class name must be 'UserServiceImpl'");
            expect(prompt).toContain('interface UserService { createUser(name: string): void; }');
        });

        it('should generate a prompt for an abstract class', () => {
            const sourceFile = project.createSourceFile(
                'src/services/user-service.ts',
                'export abstract class UserService { abstract createUser(name: string): void; }'
            );
            const declaration = sourceFile.getClass('UserService')!;
            const prompt = generatePrompt(declaration, sourceFile.getFilePath(), '/app/aesc/src/generated/userservice.service.impl.ts');

            expect(prompt).toContain('Your task is to extend the following abstract class');
            expect(prompt).toContain("The implementation class name must be 'UserServiceImpl'");
            expect(prompt).toContain('abstract class UserService { abstract createUser(name: string): void; }');
        });

        it('should include dependent types in the prompt', () => {
            project.createSourceFile(
                '/app/aesc/src/entities/user.ts',
                'export interface User { id: number; name: string; }'
            );
            project.createSourceFile(
                '/app/aesc/src/services/db-service.ts',
                'import { User } from "../entities/user"; export interface DbService { save(user: User): void; }'
            );
            const sourceFile = project.createSourceFile(
                '/app/aesc/src/services/user-service.ts',
                'import { DbService } from "./db-service"; export interface UserService { db: DbService; createUser(name: string): void; }'
            );
            const declaration = sourceFile.getInterface('UserService')!;
            const prompt = generatePrompt(declaration, sourceFile.getFilePath(), '/app/aesc/src/generated/userservice.service.impl.ts');

            expect(prompt).toContain('export interface User { id: number; name: string; }');
            expect(prompt).toContain('export interface DbService { save(user: User): void; }');
        });
    });

    describe('generateFixPrompt', () => {
        it('should generate a fix prompt for an interface', () => {
            const sourceFile = project.createSourceFile(
                'src/services/user-service.ts',
                'export interface UserService { createUser(name: string): void; }'
            );
            const declaration = sourceFile.getInterface('UserService')!;
            const currentCode = 'class UserServiceImpl implements UserService {';
            const errors = ['Syntax error: missing closing brace'];
            const prompt = generateFixPrompt(declaration, sourceFile.getFilePath(), '/app/aesc/src/generated/userservice.service.impl.ts', currentCode, errors);

            expect(prompt).toContain('Your task is to fix the following interface implementation');
            expect(prompt).toContain('interface UserService { createUser(name: string): void; }');
            expect(prompt).toContain('class UserServiceImpl implements UserService {');
            expect(prompt).toContain('Syntax error: missing closing brace');
        });
    });

    describe('extractThirdPartyLibraries', () => {
        it('should extract third-party libraries from import statements', () => {
            const code = `
                import { Something } from 'some-library';
                import AnotherThing from 'another-library';
                import * as aesc from 'aesc';
                import { LocalThing } from './local-thing';

                const x = new Something();
                const y = new AnotherThing();
            `;
            const libraries = extractThirdPartyLibraries(code);
            expect(libraries).toEqual([
                { className: 'Something', packageName: 'some-library' },
                { className: 'AnotherThing', packageName: 'another-library' },
            ]);
        });
    });
});
