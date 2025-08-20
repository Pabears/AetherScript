import { DependencyAnalysisService } from '../services/dependency-analysis-service';
import type { JSDocService } from '../services/jsdoc-service';
import { InterfaceDeclaration, ClassDeclaration, Node } from "ts-morph";
import * as path from 'path';

/**
 * @class DependencyAnalysisServiceImpl
 * @description
 * Concrete implementation of the DependencyAnalysisService.
 */
export class DependencyAnalysisServiceImpl extends DependencyAnalysisService {
    constructor(private readonly jsdocService: JSDocService) {
        super();
    }

    public async generateDependencyInfo(
        declaration: InterfaceDeclaration | ClassDeclaration,
        originalImportPath: string,
        generatedFilePath: string
    ): Promise<{ dependenciesText: string; originalCode: string }> {
        const dependentTypes = new Map<string, { path: string; code: string; isExternal: boolean }>();
        const sourceFile = declaration.getSourceFile();
        const project = sourceFile.getProject();
        const allSourceFiles = project.getSourceFiles();
        // Use the full text of the source file to reliably get imports.
        const originalCode = declaration.getSourceFile().getFullText();

        const processedTypes = new Set<string>();
        const typesToProcess = new Set<string>();

        allSourceFiles.forEach(file => {
            if (file === sourceFile) return;
            [...file.getClasses(), ...file.getInterfaces(), ...file.getEnums()].forEach(node => {
                const name = node.getName();
                if (name && originalCode.includes(name)) {
                    typesToProcess.add(name);
                }
            });
        });

        while (typesToProcess.size > 0) {
            const currentType = typesToProcess.values().next().value;
            if (!currentType || processedTypes.has(currentType)) {
                typesToProcess.delete(currentType!);
                continue;
            }
            processedTypes.add(currentType);
            typesToProcess.delete(currentType);

            allSourceFiles.forEach(file => {
                if (file === sourceFile) return;
                [...file.getClasses(), ...file.getInterfaces(), ...file.getEnums()].forEach(node => {
                    if (node.getName() === currentType) {
                        const relativePath = path.relative(path.dirname(originalImportPath), file.getFilePath());
                        const nodeCode = node.getFullText().trim();
                        dependentTypes.set(currentType, { path: relativePath, code: nodeCode, isExternal: false });
                        
                        allSourceFiles.forEach(depFile => {
                            if (depFile === sourceFile) return;
                            [...depFile.getClasses(), ...depFile.getInterfaces(), ...depFile.getEnums()].forEach(depNode => {
                                const depName = depNode.getName();
                                if (depName && nodeCode.includes(depName) && !processedTypes.has(depName)) {
                                    typesToProcess.add(depName);
                                }
                            });
                        });
                    }
                });
            });
        }

        const thirdPartyLibraries = this.extractThirdPartyLibraries(originalCode);

        for (const libraryInfo of thirdPartyLibraries) {
            const { className, packageName } = libraryInfo;
            if (!dependentTypes.has(className)) {
                const formattedCode = await this.jsdocService.getFormattedLibraryJSDoc(packageName);
                
                if (formattedCode) {
                    dependentTypes.set(className, {
                        path: `external: ${packageName}`,
                        code: formattedCode,
                        isExternal: true
                    });
                } else {
                    dependentTypes.set(className, {
                        path: `external: ${packageName}`,
                        code: `// ${className} - Third-party library (documentation not available)\nclass ${className} { constructor(...args: any[]); [key: string]: any; }`,
                        isExternal: true
                    });
                }
            }
        }

        const dependenciesText = Array.from(dependentTypes.values())
            .map(d => d.isExternal ? `// External dependency: ${d.path}\n${d.code}` : `// From: ${d.path}\n${d.code}`)
            .join('\n\n');
            
        return { dependenciesText, originalCode: declaration.getSourceFile().getFullText() };
    }

    private extractThirdPartyLibraries(codeContext: string): { className: string; packageName: string }[] {
        const classToPackageMap = new Map<string, string>();
        const libraries: { className: string; packageName: string }[] = [];
        const importRegex = /import\s+(?:([A-Z][a-zA-Z0-9_]*)|\{([^}]+)\}\s*|\*\s+as\s+([A-Z][a-zA-Z0-9_]*))\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(codeContext)) !== null) {
            const [, defaultImport, namedImports, namespaceImport, importPath] = match;
            if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
                const packageName = importPath.startsWith('@') ? importPath.split('/').slice(0, 2).join('/') : importPath.split('/')[0];
                if (defaultImport && !this.isBuiltInType(defaultImport) && !this.isProjectType(defaultImport)) {
                    classToPackageMap.set(defaultImport, packageName!);
                }
                if (namedImports) {
                    namedImports.split(',').forEach(imp => {
                        const className = imp.trim().split(' as ')[0]?.trim();
                        if (className && !this.isBuiltInType(className) && !this.isProjectType(className)) {
                            classToPackageMap.set(className, packageName!);
                        }
                    });
                }
                if (namespaceImport && !this.isBuiltInType(namespaceImport) && !this.isProjectType(namespaceImport)) {
                    classToPackageMap.set(namespaceImport, packageName!);
                }
            }
        }
        const constructorRegex = /new\s+([A-Z][a-zA-Z0-9_]*)/g;
        const propertyRegex = /:\s*([A-Z][a-zA-Z0-9_]*)/g;
        const usedClasses = new Set<string>();
        while ((match = constructorRegex.exec(codeContext)) !== null) {
            if (match[1] && !this.isBuiltInType(match[1]) && !this.isProjectType(match[1])) usedClasses.add(match[1]);
        }
        while ((match = propertyRegex.exec(codeContext)) !== null) {
            if (match[1] && !this.isBuiltInType(match[1]) && !this.isProjectType(match[1])) usedClasses.add(match[1]);
        }

        for (const className of usedClasses) {
            const packageName = classToPackageMap.get(className);
            if (packageName) {
                libraries.push({ className, packageName });
            }
        }
        return libraries;
    }

    private isBuiltInType(typeName: string): boolean {
        const builtInTypes = ['Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Error', 'Function', 'Buffer', 'URL', 'URLSearchParams'];
        return builtInTypes.includes(typeName);
    }

    private isProjectType(typeName: string): boolean {
        const projectSuffixes = ['Service', 'Controller', 'Entity', 'Model', 'Repository', 'Manager', 'Handler'];
        return projectSuffixes.some(suffix => typeName.endsWith(suffix)) || ['User', 'DB'].includes(typeName);
    }
}