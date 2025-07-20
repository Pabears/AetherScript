import { InterfaceDeclaration, ClassDeclaration, Node, ts, SourceFile } from "ts-morph";
import type { GeneratedService } from './file-analysis';
import { JSDocIndexer } from './jsdoc/indexer';
import { JSDocFormatter } from './jsdoc/formatter';
import * as path from 'path';

/**
 * Extract third-party library information from code context
 * Build mapping between class names and package names by parsing import statements
 */
function extractThirdPartyLibraries(codeContext: string): { className: string; packageName: string }[] {
    const classToPackageMap = new Map<string, string>();
    const libraries: { className: string; packageName: string }[] = [];
    
    // 1. First parse all import statements to build class name to package name mapping
    const importRegex = /import\s+(?:([A-Z][a-zA-Z0-9_]*)|\{([^}]+)\}|\*\s+as\s+([A-Z][a-zA-Z0-9_]*))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(codeContext)) !== null) {
        const defaultImport = match[1];
        const namedImports = match[2];
        const namespaceImport = match[3];
        const importPath = match[4];
        
        // Only handle third-party libraries (non-relative paths)
        if (importPath && !importPath.startsWith('.') && !importPath.startsWith('/')) {
            const packageName = importPath.startsWith('@') 
                ? importPath.split('/').slice(0, 2).join('/') // scoped package
                : importPath.split('/')[0]; // regular package
            
            // Handle default imports
            if (defaultImport && packageName && !isBuiltInType(defaultImport) && !isProjectType(defaultImport)) {
                classToPackageMap.set(defaultImport, packageName);
            }
            
            // Handle named imports
            if (namedImports && packageName) {
                const imports = namedImports.split(',').map(imp => imp.trim());
                for (const imp of imports) {
                    const className = imp.split(' as ')[0]?.trim();
                    if (className && !isBuiltInType(className) && !isProjectType(className)) {
                        classToPackageMap.set(className, packageName);
                    }
                }
            }
            
            // Handle namespace imports
            if (namespaceImport && packageName && !isBuiltInType(namespaceImport) && !isProjectType(namespaceImport)) {
                classToPackageMap.set(namespaceImport, packageName);
            }
        }
    }
    
    // 2. Detect classes used in code and find corresponding package names
    const constructorRegex = /new\s+([A-Z][a-zA-Z0-9_]*)/g;
    const usedClasses = new Set<string>();
    
    while ((match = constructorRegex.exec(codeContext)) !== null) {
        const className = match[1];
        if (className && !isBuiltInType(className) && !isProjectType(className)) {
            usedClasses.add(className);
        }
    }
    
    // 3. Find corresponding package name for each used class
    for (const className of usedClasses) {
        const packageName = classToPackageMap.get(className);
        if (packageName) {
            libraries.push({ className, packageName });
        } else {
            // If no mapping found, use heuristic package name mapping (fallback)
            // Convert camelCase to kebab-case, e.g. NodeCache -> node-cache
            const kebabCasePackageName = className
                .replace(/([A-Z])/g, (match, letter, index) => 
                    index === 0 ? letter.toLowerCase() : '-' + letter.toLowerCase()
                );
            libraries.push({ className, packageName: kebabCasePackageName });
        }
    }
    
    return libraries;
}

/**
 * Check if it's a built-in type
 */
function isBuiltInType(typeName: string): boolean {
    const builtInTypes = [
        'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
        'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Error', 'Function',
        'Buffer', 'URL', 'URLSearchParams'
    ];
    return builtInTypes.includes(typeName);
}

/**
 * Check if it's a project-internal type (based on common project type naming patterns)
 */
function isProjectType(typeName: string): boolean {
    // Project-internal types usually end with Service, Controller, Entity, Model, etc.
    const projectSuffixes = ['Service', 'Controller', 'Entity', 'Model', 'Repository', 'Manager', 'Handler'];
    return projectSuffixes.some(suffix => typeName.endsWith(suffix)) || 
           typeName === 'User' || typeName === 'DB'; // Project-specific types
}

export function generatePrompt(
    declaration: InterfaceDeclaration | ClassDeclaration, 
    originalImportPath: string, 
    generatedFilePath: string,
    provider?: string
): string {
    const interfaceName = declaration.getName();
    if (!interfaceName) {
        throw new Error("Cannot generate implementation for an anonymous class or interface.");
    }

    const dependentTypes = new Map<string, { path: string, code: string, isExternal: boolean }>();

    const addDependencies = (node: Node) => {
        if (!node || !node.getSourceFile) return;
        const sourceFile = node.getSourceFile();
        
        // Process both internal and external dependencies
        // 1. Check TypeReferences (e.g., function parameters, return types)
        const types = node.getDescendantsOfKind(ts.SyntaxKind.TypeReference);
        types.forEach(typeRef => {
            processSymbol(typeRef.getType().getSymbol());
        });
        
        // 2. Check Identifiers in constructor calls (e.g., 'new NodeCache()')
        const newExpressions = node.getDescendantsOfKind(ts.SyntaxKind.NewExpression);
        newExpressions.forEach(newExpr => {
            const identifier = newExpr.getExpression();
            if (Node.isIdentifier(identifier)) {
                const symbol = identifier.getSymbol();
                if (symbol) {
                    processSymbol(symbol);
                }
            }
        });
        
        function processSymbol(symbol: any) {
            if (!symbol) return;
            const name = symbol.getName();
            if (['Promise', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never'].includes(name) || dependentTypes.has(name)) return;
            
            for (const decl of symbol.getDeclarations()) {
                const declSourceFile = decl.getSourceFile();
                if (declSourceFile) {
                    const isExternal = declSourceFile.isFromExternalLibrary() || declSourceFile.isDeclarationFile();
                    
                    if (isExternal) {
                        // For external libraries, try to get basic type info
                        const typeInfo = getExternalTypeInfo(name, decl);
                        if (typeInfo) {
                            dependentTypes.set(name, { 
                                path: `external: ${name}`, 
                                code: typeInfo, 
                                isExternal: true 
                            });
                        }
                    } else {
                        // For internal dependencies, only include class/interface declarations
                        if (Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl)) {
                            const importPath = path.relative(path.dirname(generatedFilePath), declSourceFile.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
                            dependentTypes.set(name, { 
                                path: importPath, 
                                code: decl.getText(), 
                                isExternal: false 
                            });
                            addDependencies(decl);
                        }
                    }
                }
            }
        }
    };

    // Helper function to extract basic type information for external dependencies
    const getExternalTypeInfo = (name: string, decl: Node): string | null => {
        try {
            // Try to get constructor signatures and key methods
            const text = decl.getText();
            if (text.includes('class') || text.includes('interface')) {
                // For external types, return a simplified version
                return `// External type: ${name}\n${text.substring(0, 500)}...`;
            }
            return null;
        } catch {
            return null;
        }
    };

    addDependencies(declaration);

    const originalCode = declaration.getText();
    const allDependentCode = Array.from(dependentTypes.values()).map(dep => dep.code).join('\n');
    
    // Only extract third-party libraries from the original code (direct dependencies)
    // Do not include transitive dependencies from allDependentCode
    const thirdPartyLibraries = extractThirdPartyLibraries(originalCode);
    
    // Initialize JSDoc indexer and formatter
    // generatedFilePath is like /Users/.../demo/src/generated/file.ts
    // We need to get to the demo directory which contains tsconfig.json
    const demoPath = generatedFilePath.includes('/demo/') 
        ? generatedFilePath.substring(0, generatedFilePath.indexOf('/demo/') + 5)
        : path.dirname(path.dirname(path.dirname(generatedFilePath)));
    const jsdocIndexer = new JSDocIndexer(demoPath);
    const jsdocFormatter = new JSDocFormatter();
    
    // Process each detected third-party library
    for (const libraryInfo of thirdPartyLibraries) {
        const { className, packageName } = libraryInfo;
        
        if (!dependentTypes.has(className)) {
            console.log(`[JSDoc] Loading documentation for ${className} from package ${packageName}...`);
            const jsdocInfo = jsdocIndexer.loadLibraryJSDoc(packageName);
            
            if (jsdocInfo) {
                const formattedCode = jsdocFormatter.formatForLLM(jsdocInfo);
                dependentTypes.set(className, {
                    path: `external: ${packageName}`,
                    code: formattedCode,
                    isExternal: true
                });
                console.log(`[JSDoc] Successfully loaded ${className} documentation from ${packageName} index`);
            } else {
                console.log(`[JSDoc] No indexed documentation found for ${packageName}, using fallback for ${className}`);
                // Fallback to basic type definition for unknown libraries
                dependentTypes.set(className, {
                    path: `external: ${packageName}`,
                    code: `// ${className} - Third-party library (documentation not available)\n// Please refer to the library's official documentation for usage details\nclass ${className} {\n    constructor(...args: any[]);\n    [key: string]: any;\n}`,
                    isExternal: true
                });
            }
        }
    }

    const dependenciesText = Array.from(dependentTypes.entries())
        .map(([_, { path, code, isExternal }]) => {
            if (isExternal) {
                return `// External dependency: ${path}\n${code}`;
            } else {
                return `// From: ${path}\n${code}`;
            }
        })
        .join('\n\n');

    const fixedOriginalCode = originalCode.replace(/\.len\b/g, '.length');

    // This is the new, much stricter prompt
    const prompt = `You are a TypeScript code generation engine.
Your task is to implement the following abstract class.
You must follow these rules strictly:
1. The implementation class name must be '${interfaceName}Impl'.
2. The implementation class MUST 'extend' the original abstract class '${interfaceName}'.
3. You MUST implement all abstract methods directly. Do NOT create private helper methods for the core logic.
4. You MUST NOT redeclare any properties already present in the base class. Access them with 'this'.
5. IMPORTANT: Do NOT create unnecessary temporary objects for validation or processing. Validate data directly using appropriate methods (e.g., regex for email validation, direct string/number checks).
6. Your response MUST be only the raw TypeScript code. No explanations, no markdown.

Here are the dependent type definitions:
\`\`\`typescript
${dependenciesText}
\`\`\`

Here is the abstract class you must implement:
\`\`\`typescript
${fixedOriginalCode}
\`\`\`
`;

    return prompt;
}
