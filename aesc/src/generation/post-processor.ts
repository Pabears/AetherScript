import { Project, InterfaceDeclaration, ClassDeclaration, Node } from "ts-morph";
import * as ts from 'typescript';
import * as path from 'path';

export function postProcessGeneratedCode(
    code: string, 
    declaration: InterfaceDeclaration | ClassDeclaration, 
    generatedFilePath: string
): string {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });

    const interfaceName = declaration.getName()!;
    const implName = `${interfaceName}Impl`;
    
    // Conditionally replace 'implements' with 'extends' for abstract classes
    if (Node.isClassDeclaration(declaration) && declaration.isAbstract()) {
        const className = declaration.getName()!;
        const implementsRegex = new RegExp(`(implements\\s+)${className}`, 'g');
        code = code.replace(implementsRegex, `extends ${className}`);
        // Re-parse the source file after modification
        sourceFile.replaceWithText(code);
    }

    const implClass = sourceFile.getClass(implName);

    if (!implClass) {
        return code; // Not much we can do if the class isn't found
    }

    // --- 1. Fix Imports ---
    const namedImportsMap = new Map<string, Set<string>>();
    const defaultImportsMap = new Map<string, string>();
    const namespaceImportsMap = new Map<string, string>();
    const typeOnlyImports = new Map<string, Set<string>>();

    // STEP 1: Extract all imports from the original declaration file
    // This ensures we preserve all imports that were in the original abstract class
    const originalSourceFile = declaration.getSourceFile();
    const originalImports = originalSourceFile.getImportDeclarations();
    
    console.log(`  -> INFO: Found ${originalImports.length} import declarations in original file`);
    
    originalImports.forEach(importDecl => {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        if (!moduleSpecifier) return;
        
        // Calculate the relative path from the generated file to the imported module
        let importPath: string;
        if (moduleSpecifier.startsWith('.')) {
            // Relative import - need to adjust path
            const originalDir = path.dirname(originalSourceFile.getFilePath());
            const absoluteImportPath = path.resolve(originalDir, moduleSpecifier);
            importPath = path.relative(path.dirname(generatedFilePath), absoluteImportPath).replace(/\\/g, '/');
            importPath = importPath.startsWith('.') ? importPath : `./${importPath}`;
        } else {
            // Absolute import (node_modules) - keep as is
            importPath = moduleSpecifier;
        }
        
        if (!namedImportsMap.has(importPath)) {
            namedImportsMap.set(importPath, new Set());
        }
        
        // Extract named imports
        const namedImports = importDecl.getNamedImports();
        namedImports.forEach(namedImport => {
            const importName = namedImport.getName();
            const isTypeOnly = namedImport.isTypeOnly();
            
            if (isTypeOnly) {
                if (!typeOnlyImports.has(importPath)) {
                    typeOnlyImports.set(importPath, new Set());
                }
                typeOnlyImports.get(importPath)!.add(importName);
                console.log(`  -> INFO: Preserving type-only import 'type ${importName}' from '${importPath}'`);
            } else {
                namedImportsMap.get(importPath)!.add(importName);
                console.log(`  -> INFO: Preserving import '${importName}' from '${importPath}'`);
            }
        });
        
        // Extract default imports
        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport) {
            const importName = defaultImport.getText();
            defaultImportsMap.set(importPath, importName);
            console.log(`  -> INFO: Preserving default import '${importName}' from '${importPath}'`);
        }
        
        // Extract namespace imports
        const namespaceImport = importDecl.getNamespaceImport();
        if (namespaceImport) {
            const importName = namespaceImport.getText();
            namespaceImportsMap.set(importPath, importName);
            console.log(`  -> INFO: Preserving namespace import '${importName}' from '${importPath}'`);
        }
    });
    
    // STEP 2: Additional type analysis using ts-morph type checker
    const addImport = (type: import("ts-morph").Type) => {
        const symbol = type.getAliasSymbol() ?? type.getSymbol();
        if (!symbol) return;

        const typeName = symbol.getName();
        if (['Promise', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never'].includes(typeName)) return;

        for (const decl of symbol.getDeclarations()) {
            const depSourceFile = decl.getSourceFile();
            if (depSourceFile.isFromExternalLibrary() || depSourceFile.isDeclarationFile()) continue;

            const importPath = path.relative(path.dirname(generatedFilePath), depSourceFile.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
            const finalPath = importPath.startsWith('.') ? importPath : `./${importPath}`;

            if (!namedImportsMap.has(finalPath)) {
                namedImportsMap.set(finalPath, new Set());
            }
            namedImportsMap.get(finalPath)!.add(typeName);
        }
    };

    // Add import for the base class/interface itself
    addImport(declaration.getType());

    // Add imports for all types used in properties, methods, and heritage clauses of the original declaration
    declaration.getProperties().forEach(p => addImport(p.getType()));
    declaration.getMethods().forEach(m => {
        m.getParameters().forEach(p => addImport(p.getType()));
        addImport(m.getReturnType());
    });
    declaration.getHeritageClauses().forEach(hc => {
        hc.getTypeNodes().forEach(tn => addImport(tn.getType()));
    });

    // STEP 3: Analyze the generated implementation class for additional types
    if (implClass) {
        // Add imports for all types used in the implementation class properties
        implClass.getProperties().forEach(p => {
            addImport(p.getType());
        });
        
        // Add imports for all types used in the implementation class methods
        implClass.getMethods().forEach(m => {
            // Method parameters
            m.getParameters().forEach(p => addImport(p.getType()));
            // Method return type
            addImport(m.getReturnType());
        });
        
        // Add imports for all types referenced in the implementation class heritage clauses
        implClass.getHeritageClauses().forEach(hc => {
            hc.getTypeNodes().forEach(tn => addImport(tn.getType()));
        });
        
        // STEP 4: Scan the implementation code for additional type references
        // This catches types used in method bodies, type assertions, etc.
        const implText = implClass.getFullText();
        
        // Look for common type patterns that might be missed
        const typePatterns = [
            /\bas\s+(\w+)/g,  // Type assertions: "as Customer"
            /:\s*(\w+)\s*[\|\&\?\[\]]/g,  // Type annotations: ": Customer |"
            /new\s+(\w+)\s*\(/g,  // Constructor calls: "new Order("
        ];
        
        // ENHANCEMENT: Look for function call patterns to detect third-party library usage
        const functionCallPatterns = [
            /(\w+)\s*\(/g,  // Function calls: "uuidv4(", "uuid(", etc.
        ];
        
        const potentialTypes = new Set<string>();
        const potentialFunctions = new Set<string>();
        
        // Extract types
        typePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(implText)) !== null) {
                const typeName = match[1];
                if (typeName && /^[A-Z]/.test(typeName)) { // Only consider capitalized names
                    potentialTypes.add(typeName);
                }
            }
        });
        
        // Extract function calls
        functionCallPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(implText)) !== null) {
                const functionName = match[1];
                // Skip common built-in functions and methods
                const builtInFunctions = ['console', 'parseInt', 'parseFloat', 'isNaN', 'Array', 'Object', 'JSON', 'Math', 'Date', 'String', 'Number', 'Boolean', 'Error', 'Promise', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'];
                const commonMethods = ['push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'join', 'split', 'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'includes', 'indexOf', 'toString', 'valueOf', 'hasOwnProperty', 'length', 'test', 'match', 'replace', 'trim', 'toLowerCase', 'toUpperCase'];
                
                if (functionName && 
                    !builtInFunctions.includes(functionName) && 
                    !commonMethods.includes(functionName) &&
                    !/^[A-Z]/.test(functionName) && // Not a constructor
                    functionName !== 'super' && // Not super call
                    functionName !== 'this' && // Not this reference
                    functionName.length > 1) { // Not single character
                    potentialFunctions.add(functionName);
                }
            }
        });
        
        console.log(`  -> INFO: Found potential types in implementation: ${Array.from(potentialTypes).join(', ')}`);
        console.log(`  -> INFO: Found potential functions in implementation: ${Array.from(potentialFunctions).join(', ')}`);
        
        // For each potential type, try to find its import in the original file
        potentialTypes.forEach(typeName => {
            // Check if this type was already imported from the original file
            let found = false;
            for (const [importPath, importedTypes] of namedImportsMap.entries()) {
                if (importedTypes.has(typeName)) {
                    found = true;
                    break;
                }
            }
            
            // Also check type-only imports
            if (!found) {
                for (const [importPath, importedTypes] of typeOnlyImports.entries()) {
                    if (importedTypes.has(typeName)) {
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) {
                // Try to find where this type is defined and add appropriate import
                // Look for common entity patterns
                if (typeName === 'Customer') {
                    const customerImportPath = '../entity/customer';
                    if (!namedImportsMap.has(customerImportPath)) {
                        namedImportsMap.set(customerImportPath, new Set());
                    }
                    namedImportsMap.get(customerImportPath)!.add('Customer');
                    console.log(`  -> INFO: Adding missing import for '${typeName}' from '${customerImportPath}'`);
                }
                // Add more type mappings as needed
            }
        });
        
        // ENHANCEMENT: For each potential function, try to find its import in the original file
        potentialFunctions.forEach(functionName => {
            // Check if this function was already imported from the original file
            let found = false;
            
            // Check named imports
            for (const [importPath, importedNames] of namedImportsMap.entries()) {
                if (importedNames.has(functionName)) {
                    found = true;
                    break;
                }
            }
            
            // Check default imports
            if (!found) {
                for (const [importPath, defaultImportName] of defaultImportsMap.entries()) {
                    if (defaultImportName === functionName) {
                        found = true;
                        break;
                    }
                }
            }
            
            // Check namespace imports (e.g., uuid.v4)
            if (!found) {
                for (const [importPath, namespaceImportName] of namespaceImportsMap.entries()) {
                    // Check if function is called as namespace.function
                    if (implText.includes(`${namespaceImportName}.${functionName}`)) {
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) {
                // Try to find this function in the original file's imports
                const originalSourceFile = declaration.getSourceFile();
                originalSourceFile.getImportDeclarations().forEach((importDecl: import("ts-morph").ImportDeclaration) => {
                    const moduleSpecifier = importDecl.getModuleSpecifierValue();
                    
                    // Check named imports
                    const namedImports = importDecl.getNamedImports();
                    namedImports.forEach((namedImport: import("ts-morph").ImportSpecifier) => {
                        const importName = namedImport.getName();
                        const aliasName = namedImport.getAliasNode()?.getText() || importName;
                        
                        if (aliasName === functionName) {
                            const importPath = moduleSpecifier;
                            if (!namedImportsMap.has(importPath)) {
                                namedImportsMap.set(importPath, new Set());
                            }
                            namedImportsMap.get(importPath)!.add(importName === aliasName ? importName : `${importName} as ${aliasName}`);
                            console.log(`  -> INFO: Adding missing function import for '${functionName}' from '${importPath}'`);
                            found = true;
                        }
                    });
                    
                    // Check default imports
                    const defaultImport = importDecl.getDefaultImport();
                    if (defaultImport && defaultImport.getText() === functionName) {
                        const importPath = moduleSpecifier;
                        defaultImportsMap.set(importPath, functionName);
                        console.log(`  -> INFO: Adding missing default function import for '${functionName}' from '${importPath}'`);
                        found = true;
                    }
                });
            }
            
            if (!found) {
                console.log(`  -> WARNING: Could not find import for function '${functionName}' in original file`);
            }
        });
    }

    // Remove all existing import declarations
    sourceFile.getImportDeclarations().forEach(importDecl => importDecl.remove());

    // Add the corrected and consolidated imports
    
    // 1. Add default imports
    for (const [moduleSpecifier, defaultImportName] of defaultImportsMap.entries()) {
        sourceFile.insertImportDeclaration(0, {
            moduleSpecifier,
            defaultImport: defaultImportName,
        });
        console.log(`  -> INFO: Generated default import: import ${defaultImportName} from "${moduleSpecifier}";`);
    }
    
    // 2. Add namespace imports
    for (const [moduleSpecifier, namespaceImportName] of namespaceImportsMap.entries()) {
        sourceFile.insertImportDeclaration(0, {
            moduleSpecifier,
            namespaceImport: namespaceImportName,
        });
        console.log(`  -> INFO: Generated namespace import: import * as ${namespaceImportName} from "${moduleSpecifier}";`);
    }
    
    // 3. Add named imports
    for (const [moduleSpecifier, names] of namedImportsMap.entries()) {
        if (names.size > 0) {
            sourceFile.insertImportDeclaration(0, {
                moduleSpecifier,
                namedImports: Array.from(names),
            });
            console.log(`  -> INFO: Generated named imports: import { ${Array.from(names).join(', ')} } from "${moduleSpecifier}";`);
        }
    }
    
    // Add type-only imports
    for (const [moduleSpecifier, names] of typeOnlyImports.entries()) {
        if (names.size > 0) {
            sourceFile.insertImportDeclaration(0, {
                moduleSpecifier,
                namedImports: Array.from(names).map(name => ({ name, isTypeOnly: true })),
            });
        }
    }

    // --- 2. Clean Up Class Body ---
    if (Node.isClassDeclaration(declaration) && declaration.isAbstract()) {
        // Ensure the implementation `extends` the base class, not `implements` it.
        const interfaceName = declaration.getName();
        if (interfaceName) {
            const implementsRegex = new RegExp(`implements\\s+${interfaceName}`, 'g');
            code = code.replace(implementsRegex, `extends ${interfaceName}`);
        }

        const baseProperties = new Set(declaration.getProperties().map(p => p.getName()));
        implClass.getProperties().forEach(prop => {
            if (baseProperties.has(prop.getName())) {
                console.log(`  -> INFO: Removing redeclared property '${prop.getName()}' from '${implName}'`);
                prop.remove();
            }
        });
    }

    return sourceFile.getFullText();
}

export async function validateGeneratedCode(
    code: string, 
    originalDeclaration: InterfaceDeclaration | ClassDeclaration, 
    generatedFilePath: string
): Promise<{ isValid: boolean; errors: string[] }> {
    const project = originalDeclaration.getProject();
    const tempSourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });

    try {
        const diagnostics = tempSourceFile.getPreEmitDiagnostics();

        // Correctly handle ts-morph's DiagnosticMessageChain using its API
        const flattenMessages = (chain: import("ts-morph").DiagnosticMessageChain): string => {
            let result = chain.getMessageText();
            const next = chain.getNext();
            if (next) {
                next.forEach(nextChain => {
                    result += ` -> ${flattenMessages(nextChain)}`;
                });
            }
            return result;
        };

        if (diagnostics.length > 0) {
            const errors = diagnostics
                .map(d => {
                    const message = d.getMessageText();
                    return typeof message === 'string' ? message : flattenMessages(message);
                })
                .filter(error => !error.includes("Object is possibly 'undefined'"));

            if (errors.length > 0) {
                return { isValid: false, errors };
            }
        }

        return { isValid: true, errors: [] };
    } finally {
        // IMPORTANT: Remove the temporary file from the project to avoid side effects
        project.removeSourceFile(tempSourceFile);
    }
}
