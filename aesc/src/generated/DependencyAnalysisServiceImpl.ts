import { DependencyAnalysisService } from '../services/DependencyAnalysisService';
import type { ClassDeclaration, InterfaceDeclaration, DependencyInfo } from '../services/types';
import { Node, ts } from "ts-morph";
import * as path from 'path';
import { container } from './container';

function extractThirdPartyLibraries(codeContext: string): { className: string; packageName: string }[] {
    const classToPackageMap = new Map<string, string>();
    const libraries: { className: string; packageName: string }[] = [];
    const importRegex = /import\s+(?:([A-Z][a-zA-Z0-9_]*)|\{([^}]+)\}|\*\s+as\s+([A-Z][a-zA-Z0-9_]*))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(codeContext)) !== null) {
        const [, defaultImport, namedImports, namespaceImport, importPath] = match;
        if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
            const packageName = importPath.startsWith('@') ? importPath.split('/').slice(0, 2).join('/') : importPath.split('/')[0];
            if (defaultImport && !isBuiltInType(defaultImport)) classToPackageMap.set(defaultImport, packageName);
            if (namedImports) namedImports.split(',').map(i => i.trim()).forEach(i => { const c = i.split(' as ')[0]?.trim(); if (c && !isBuiltInType(c)) classToPackageMap.set(c, packageName); });
            if (namespaceImport && !isBuiltInType(namespaceImport)) classToPackageMap.set(namespaceImport, packageName);
        }
    }
    const constructorRegex = /new\s+([A-Z][a-zA-Z0-9_]*)/g;
    const usedClasses = new Set<string>();
    while ((match = constructorRegex.exec(codeContext)) !== null) {
        const className = match[1];
        if (className && !isBuiltInType(className)) usedClasses.add(className);
    }
    for (const className of usedClasses) {
        const packageName = classToPackageMap.get(className) || className.replace(/([A-Z])/g, (m, l, i) => i === 0 ? l.toLowerCase() : '-' + l.toLowerCase());
        libraries.push({ className, packageName });
    }
    return libraries;
}

function isBuiltInType(typeName: string): boolean {
    return ['Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Error', 'Function', 'Buffer', 'URL', 'URLSearchParams'].includes(typeName);
}

export class DependencyAnalysisServiceImpl implements DependencyAnalysisService {
    public generateDependencyInfo(declaration: InterfaceDeclaration | ClassDeclaration, originalImportPath: string, generatedFilePath: string): DependencyInfo {
        const jsdocService = container.get('JsdocService');
        const dependentTypes = new Map<string, { path: string; code: string; isExternal: boolean }>();
        const sourceFile = declaration.getSourceFile();
        const project = sourceFile.getProject();
        const allSourceFiles = project.getSourceFiles();
        const originalCode = declaration.getFullText();
        const processedTypes = new Set<string>();
        const typesToProcess = new Set<string>();

        allSourceFiles.forEach((file: any) => {
            if (file === sourceFile) return;
            [...file.getClasses(), ...file.getInterfaces(), ...file.getEnums()].forEach((node: any) => {
                const name = node.getName() ?? '';
                if (name && originalCode.includes(name)) {
                    typesToProcess.add(name);
                }
            });
        });

        while (typesToProcess.size > 0) {
            const currentType = typesToProcess.values().next().value;
            if (!currentType) break;
            typesToProcess.delete(currentType);
            if (processedTypes.has(currentType)) continue;
            processedTypes.add(currentType);

            allSourceFiles.forEach((file: any) => {
                if (file === sourceFile) return;
                [...file.getClasses(), ...file.getInterfaces(), ...file.getEnums()].forEach((node: any) => {
                    const nodeName = node.getName() ?? '';
                    if (nodeName && nodeName === currentType) {
                        const relativePath = path.relative(path.dirname(originalImportPath), file.getFilePath()).replace(/\\/g, '/');
                        const nodeCode = node.getFullText().trim();
                        dependentTypes.set(currentType, { path: relativePath, code: nodeCode, isExternal: false });

                        [...file.getClasses(), ...file.getInterfaces(), ...file.getEnums()].forEach((sameFileNode: any) => {
                            const sameFileName = sameFileNode.getName() ?? '';
                            if (sameFileName && sameFileName !== currentType && !processedTypes.has(sameFileName)) {
                                dependentTypes.set(sameFileName, { path: relativePath, code: sameFileNode.getFullText().trim(), isExternal: false });
                                processedTypes.add(sameFileName);
                            }
                        });

                        allSourceFiles.forEach((depFile: any) => {
                            if (depFile === sourceFile) return;
                            [...depFile.getClasses(), ...depFile.getInterfaces(), ...depFile.getEnums()].forEach((depNode: any) => {
                                const depName = depNode.getName() ?? '';
                                if (depName && nodeCode.includes(depName) && !processedTypes.has(depName)) {
                                    typesToProcess.add(depName);
                                }
                            });
                        });
                    }
                });
            });
        }

        const thirdPartyLibraries = extractThirdPartyLibraries(originalCode);
        for (const { className, packageName } of thirdPartyLibraries) {
            if (!dependentTypes.has(className)) {
                const jsdocInfo = jsdocService.getLibraryJSDoc(packageName);
                if (jsdocInfo) {
                    const formattedCode = `// JSDoc for ${className} from ${packageName}\nclass ${className} { /* ...omitted... */ }`;
                    dependentTypes.set(className, { path: `external: ${packageName}`, code: formattedCode, isExternal: true });
                } else {
                    dependentTypes.set(className, { path: `external: ${packageName}`, code: `// ${className} - Third-party library\nclass ${className} { constructor(...args: any[]); [key: string]: any; }`, isExternal: true });
                }
            }
        }

        const dependenciesText = Array.from(dependentTypes.values()).map(d => `// From: ${d.path}\n${d.code}`).join('\n\n');
        return { dependenciesText, originalCode };
    }
}
