import { FileAnalysisService } from '../services/FileAnalysisService';
import type {
    PropertyDependency,
    ClassDeclaration,
    CodeProject,
    InterfaceDeclaration
} from '../services/types';
import { Project, Node } from "ts-morph";
import * as path from 'path';

export class FileAnalysisServiceImpl implements FileAnalysisService {

    public getDependencies(cls: ClassDeclaration): { constructorDeps: string[], propertyDeps: PropertyDependency[] } {
        const constructorDeps: string[] = [];
        const propertyDeps: PropertyDependency[] = [];

        const constructor = cls.getConstructors()[0];
        if (constructor) {
            for (const param of constructor.getParameters()) {
                const paramType = param.getType();
                const typeText = paramType.getText();
                if (typeText !== 'any' && typeText !== 'unknown') {
                    constructorDeps.push(typeText);
                }
            }
        }

        for (const prop of cls.getProperties()) {
            if (prop.getDecorator("AutoGen")) {
                const propType = prop.getType();
                const targetType = propType.isUnion() ? propType.getUnionTypes().find((t: any) => !t.isUndefined()) : propType;
                if (targetType) {
                    propertyDeps.push({
                        name: prop.getName(),
                        type: targetType.getText()
                    });
                }
            }
        }

        return { constructorDeps, propertyDeps };
    }

    public analyzeSourceFiles(project: Project, files: string[]): Map<string, { declaration: InterfaceDeclaration | ClassDeclaration, sourceFile: any }> {
        const servicesToGenerate = new Map<string, { declaration: InterfaceDeclaration | ClassDeclaration, sourceFile: any }>();

        let allSourceFiles = project.getSourceFiles("src/**/*.ts");

        if (files.length > 0) {
            const lowerCaseFiles = files.map(f => f.toLowerCase());
            allSourceFiles = allSourceFiles.filter((sf: any) => {
                const fileName = path.basename(sf.getFilePath()).toLowerCase();
                return lowerCaseFiles.includes(fileName);
            });
        }

        for (const sourceFile of allSourceFiles) {
            const classes = sourceFile.getClasses();
            for (const cls of classes) {
                for (const prop of cls.getProperties()) {
                    if (!prop.getDecorator("AutoGen")) continue;

                    console.log(`Found @AutoGen on ${cls.getName()}.${prop.getName()}`);
                    const propType = prop.getType();
                    const targetType = propType.isUnion() ? propType.getUnionTypes().find((t: any) => !t.isUndefined()) : propType;

                    if (!targetType) {
                        console.error(`  -> Error: Could not resolve type for ${prop.getName()}`);
                        continue;
                    }
                    const typeSymbol = targetType.getSymbol();
                    if (!typeSymbol) {
                        console.error(`  -> Error: Could not find symbol for type ${targetType.getText()}`);
                        continue;
                    }
                    const decl = typeSymbol.getDeclarations()[0];
                    if (!decl || (!Node.isInterfaceDeclaration(decl) && !(Node.isClassDeclaration(decl) && decl.isAbstract()))) {
                         console.error(`  -> Error: Type ${targetType.getText()} is not a resolvable interface or abstract class.`);
                        continue;
                    }
                    const interfaceName = decl.getName()!;
                    if (!servicesToGenerate.has(interfaceName)) {
                        const dependencySourceFile = decl.getSourceFile();
                        servicesToGenerate.set(interfaceName, { declaration: decl, sourceFile: dependencySourceFile });
                    }
                }
            }
        }

        return servicesToGenerate;
    }
}
