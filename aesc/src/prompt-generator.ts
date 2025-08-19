import { InterfaceDeclaration, ClassDeclaration, Node, ts, SourceFile } from "ts-morph";
import type { GeneratedService } from './file-analysis';
import { JSDocIndexer } from './jsdoc/indexer';
import { JSDocFormatter } from './jsdoc/formatter';
import * as path from 'path';

/**
 * Generate dependency information for a given declaration
 * This includes both project-internal dependencies and third-party libraries with JSDoc
 */
function generateDependencyInfo(
    declaration: InterfaceDeclaration | ClassDeclaration,
    originalImportPath: string,
    generatedFilePath: string
): { dependenciesText: string; originalCode: string } {
    const dependentTypes = new Map<string, { path: string; code: string; isExternal: boolean }>();
    
    // Get all dependent services from the same project
    const sourceFile = declaration.getSourceFile();
    const project = sourceFile.getProject();
    const allSourceFiles = project.getSourceFiles();
    
    // Find dependencies by analyzing the declaration
    const originalCode = declaration.getFullText();
    
    // Extract project dependencies with recursive analysis
    const processedTypes = new Set<string>();
    const typesToProcess = new Set<string>();
    
    // Find initial dependencies from the original code
    allSourceFiles.forEach(file => {
        if (file === sourceFile) return;
        
        const classes = file.getClasses();
        const interfaces = file.getInterfaces();
        const enums = file.getEnums();
        
        [...classes, ...interfaces, ...enums].forEach(node => {
            const name = node.getName();
            if (name && originalCode.includes(name)) {
                typesToProcess.add(name);
            }
        });
    });
    
    // Recursively process dependencies
    while (typesToProcess.size > 0) {
        const currentType = typesToProcess.values().next().value;
        if (!currentType) {
            break;
        }
        
        typesToProcess.delete(currentType);
        
        if (processedTypes.has(currentType)) {
            continue;
        }
        
        processedTypes.add(currentType);
        
        // Find the type definition
        allSourceFiles.forEach(file => {
            if (file === sourceFile) return;
            
            const classes = file.getClasses();
            const interfaces = file.getInterfaces();
            const enums = file.getEnums();
            
            [...classes, ...interfaces, ...enums].forEach(node => {
                const name = node.getName();
                if (name && name === currentType) {
                    const relativePath = path.relative(path.dirname(originalImportPath), file.getFilePath());
                    const nodeCode = node.getFullText().trim();
                    
                    dependentTypes.set(name, {
                        path: relativePath,
                        code: nodeCode,
                        isExternal: false
                    });
                    
                    // ENHANCEMENT: Include all types from the same file to capture related enums/interfaces
                    // This fixes issues like missing OrderStatus when Order is included
                    const sameFileClasses = file.getClasses();
                    const sameFileInterfaces = file.getInterfaces();
                    const sameFileEnums = file.getEnums();
                    
                    [...sameFileClasses, ...sameFileInterfaces, ...sameFileEnums].forEach(sameFileNode => {
                        const sameFileName = sameFileNode.getName();
                        if (sameFileName && sameFileName !== name && !processedTypes.has(sameFileName)) {
                            const sameFileCode = sameFileNode.getFullText().trim();
                            dependentTypes.set(sameFileName, {
                                path: relativePath,
                                code: sameFileCode,
                                isExternal: false
                            });
                            processedTypes.add(sameFileName);
                            console.log(`[Dependency] Auto-included same-file type: ${sameFileName} (related to ${name})`);
                        }
                    });
                    
                    // Find additional dependencies in this type's code
                    allSourceFiles.forEach(depFile => {
                        if (depFile === sourceFile) return;
                        
                        const depClasses = depFile.getClasses();
                        const depInterfaces = depFile.getInterfaces();
                        const depEnums = depFile.getEnums();
                        
                        [...depClasses, ...depInterfaces, ...depEnums].forEach(depNode => {
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
    
    // Extract third-party dependencies
    const thirdPartyLibraries = extractThirdPartyLibraries(originalCode);
    
    // Initialize JSDoc indexer and formatter
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
        
    return { dependenciesText, originalCode };
}

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

    // Use the shared dependency analysis function
    const { dependenciesText, originalCode } = generateDependencyInfo(
        declaration,
        originalImportPath,
        generatedFilePath
    );

    const fixedOriginalCode = originalCode.replace(/\.len\b/g, '.length');

    // Determine declaration type and get type-specific configurations
    const isInterface = Node.isInterfaceDeclaration(declaration);
    const isAbstractClass = Node.isClassDeclaration(declaration);
    
    if (!isInterface && !isAbstractClass) {
        throw new Error(`Unsupported declaration type for ${interfaceName}. Only interfaces and abstract classes are supported.`);
    }
    
    // Type-specific configurations
    const config = isInterface ? {
        task: 'implement the following interface',
        action: 'implement',
        target: 'interface',
        methodType: 'interface methods',
        propertyRule: 'You MUST implement all properties defined in the interface.',
        declarationLabel: 'interface you must implement'
    } : {
        task: 'extend the following abstract class and implement its abstract methods',
        action: 'extend',
        target: 'abstract class',
        methodType: 'abstract methods',
        propertyRule: 'You MUST NOT redeclare any properties already present in the base class. Access them with \'this\'.',
        declarationLabel: 'abstract class you must extend'
    };
    
    // Construct unified prompt with type-specific parts
    const prompt = `You are a TypeScript code generation engine.
Your task is to ${config.task}.
You must follow these rules strictly:
1. The implementation class name must be '${interfaceName}Impl'.
2. The implementation class MUST '${config.action}' the original ${config.target} '${interfaceName}'.
3. You MUST implement all ${config.methodType} directly. Do NOT create private helper methods for the core logic.
4. ${config.propertyRule}
5. IMPORTANT: Do NOT create unnecessary temporary objects for validation or processing. Validate data directly using appropriate methods (e.g., regex for email validation, direct string/number checks).
6. Your response MUST be only the raw TypeScript code. No explanations, no markdown.

Here are the dependent type definitions:
\`\`\`typescript
${dependenciesText}
\`\`\`

Here is the ${config.declarationLabel}:
\`\`\`typescript
${fixedOriginalCode}
\`\`\`
`;

    return prompt;
}

/**
 * Generate a specialized prompt for fixing validation errors in generated code
 * This avoids the need to extract dependencies from an existing prompt using regex
 */
export function generateFixPrompt(
    declaration: InterfaceDeclaration | ClassDeclaration,
    originalImportPath: string,
    generatedFilePath: string,
    currentCode: string,
    validationErrors: string[],
    provider?: string
): string {
    const interfaceName = declaration.getName();
    if (!interfaceName) {
        throw new Error('Declaration must have a name');
    }

    // Get the original declaration code
    const originalDeclarationCode = declaration.getFullText().trim();
    
    // Use the shared dependency analysis function
    const { dependenciesText } = generateDependencyInfo(
        declaration,
        originalImportPath,
        generatedFilePath
    );

    // Determine declaration type and get type-specific configurations
    const isInterface = Node.isInterfaceDeclaration(declaration);
    const isAbstractClass = Node.isClassDeclaration(declaration);
    
    if (!isInterface && !isAbstractClass) {
        throw new Error(`Unsupported declaration type for ${interfaceName}. Only interfaces and abstract classes are supported.`);
    }
    
    // Type-specific configurations (same as generatePrompt)
    const config = isInterface ? {
        action: 'implement',
        target: 'interface',
        methodType: 'interface methods',
        propertyRule: 'You MUST implement all properties defined in the interface.'
    } : {
        action: 'extend',
        target: 'abstract class',
        methodType: 'abstract methods',
        propertyRule: 'You MUST NOT redeclare any properties already present in the base class. Access them with \'this\'.'
    };
    
    // Check if code appears to be truncated
    const isTruncated = currentCode.trim().endsWith('//') || 
                       currentCode.trim().endsWith('/*') || 
                       !currentCode.includes('}') ||
                       currentCode.split('{').length !== currentCode.split('}').length;
    
    // Construct unified fix prompt with type-specific parts
    const fixPrompt = `You are a TypeScript code generation engine.
Your task is to fix the following ${config.target} implementation that has validation errors.

You must follow these rules strictly:
1. The implementation class name must be '${interfaceName}Impl'.
2. The implementation class MUST '${config.action}' the original ${config.target} '${interfaceName}'.
3. You MUST implement all ${config.methodType} directly. Do NOT create private helper methods for the core logic.
4. ${config.propertyRule}
5. IMPORTANT: Do NOT create unnecessary temporary objects for validation or processing. Validate data directly using appropriate methods (e.g., regex for email validation, direct string/number checks).
6. Fix all validation errors listed below.
7. ${isTruncated ? 'COMPLETE the truncated/incomplete code - ensure ALL methods are fully implemented with proper closing braces.' : 'Ensure the code is complete and syntactically correct.'}
8. Your response MUST be only the raw TypeScript code. No explanations, no markdown.

${dependenciesText ? `Here are the dependent type definitions:
\`\`\`typescript
${dependenciesText}
\`\`\`

` : ''}Here is the original ${config.target} you must ${config.action}:
\`\`\`typescript
${originalDeclarationCode}
\`\`\`

Here is the current implementation with errors:
\`\`\`typescript
${currentCode}
\`\`\`

Validation errors that must be fixed:
${validationErrors.map(err => `- ${err}`).join('\n')}

${isTruncated ? 'CRITICAL: The code appears incomplete/truncated. You must complete ALL methods with proper implementation and closing braces.\n\n' : ''}Generate the complete, corrected ${interfaceName}Impl implementation:`;

    return fixPrompt;
}
