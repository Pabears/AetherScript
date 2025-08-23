import { Project, InterfaceDeclaration, ClassDeclaration, Node } from "ts-morph";
import * as ts from 'typescript';
import * as path from 'path';
import { PostProcessorService } from "../services/post-processor-service";
import { ModelCallerService } from "../services/model-caller-service";
import { DependencyAnalysisService } from "../services/dependency-analysis-service";
import { generateFixPrompt } from "../prompts/implementation";
import type { CodeFixResult } from "../types";

export class PostProcessorServiceImpl extends PostProcessorService {
    private modelCallerService: ModelCallerService;
    private dependencyAnalysisService: DependencyAnalysisService;

    constructor(modelCallerService: ModelCallerService, dependencyAnalysisService: DependencyAnalysisService) {
        super();
        this.modelCallerService = modelCallerService;
        this.dependencyAnalysisService = dependencyAnalysisService;
    }

    private cleanGeneratedCode(
        rawResponse: string,
        interfaceName: string,
        verbose: boolean
    ): string {
        let cleanedResponse = rawResponse.trim();
        
        const tsBlockRegex = /```typescript\s*([\s\S]*?)\s*```/;
        const match = cleanedResponse.match(tsBlockRegex);
        if (match && match[1]) {
            cleanedResponse = match[1].trim();
        }

        const implClassName = `${interfaceName}Impl`;
        const classRegex = new RegExp(`(export\s+class\s+${implClassName}[\s\S]*?\n\})`, 'm');
        const classMatch = cleanedResponse.match(classRegex);

        let cleanedCode: string;
        if (classMatch && classMatch[0]) {
            cleanedCode = classMatch[0];
            if (verbose) {
                console.log(`  -> INFO: Extracted '${implClassName}' from response.`);
            }
        } else {
            if (verbose) {
                console.log(`  -> WARN: Could not extract '${implClassName}' from response. Using the full response as fallback.`);
            }
            cleanedCode = cleanedResponse;
        }

        if (verbose) {
            console.log("--- CODE BEFORE POST-PROCESSING ---");
            console.log(cleanedCode);
            console.log("---------------------------------");
        }

        return cleanedCode;
    }

    public postProcessGeneratedCode(
        code: string,
        declaration: InterfaceDeclaration | ClassDeclaration,
        generatedFilePath: string
    ): string {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });

        const interfaceName = declaration.getName()!;
        const implName = `${interfaceName}Impl`;
        
        if (Node.isClassDeclaration(declaration) && declaration.isAbstract()) {
            const className = declaration.getName()!;
            const implementsRegex = new RegExp(`(implements\s+)${className}`, 'g');
            code = code.replace(implementsRegex, `extends ${className}`);
            sourceFile.replaceWithText(code);
        }

        const implClass = sourceFile.getClass(implName);

        if (!implClass) {
            return code;
        }

        const namedImportsMap = new Map<string, Set<string>>();
        const defaultImportsMap = new Map<string, string>();
        const namespaceImportsMap = new Map<string, string>();
        const typeOnlyImports = new Map<string, Set<string>>();

        const originalSourceFile = declaration.getSourceFile();
        const originalImports = originalSourceFile.getImportDeclarations();
        
        originalImports.forEach(importDecl => {
            const moduleSpecifier = importDecl.getModuleSpecifierValue();
            if (!moduleSpecifier) return;
            
            let importPath: string;
            if (moduleSpecifier.startsWith('.')) {
                const originalDir = path.dirname(originalSourceFile.getFilePath());
                const absoluteImportPath = path.resolve(originalDir, moduleSpecifier);
                importPath = path.relative(path.dirname(generatedFilePath), absoluteImportPath).replace(/\\/g, '/');
                importPath = importPath.startsWith('.') ? importPath : `./${importPath}`;
            } else {
                importPath = moduleSpecifier;
            }
            
            if (!namedImportsMap.has(importPath)) {
                namedImportsMap.set(importPath, new Set());
            }
            
            const namedImports = importDecl.getNamedImports();
            namedImports.forEach(namedImport => {
                const importName = namedImport.getName();
                const isTypeOnly = namedImport.isTypeOnly();
                
                if (isTypeOnly) {
                    if (!typeOnlyImports.has(importPath)) {
                        typeOnlyImports.set(importPath, new Set());
                    }
                    typeOnlyImports.get(importPath)!.add(importName);
                } else {
                    namedImportsMap.get(importPath)!.add(importName);
                }
            });
            
            const defaultImport = importDecl.getDefaultImport();
            if (defaultImport) {
                const importName = defaultImport.getText();
                defaultImportsMap.set(importPath, importName);
            }
            
            const namespaceImport = importDecl.getNamespaceImport();
            if (namespaceImport) {
                const importName = namespaceImport.getText();
                namespaceImportsMap.set(importPath, importName);
            }
        });
        
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

        addImport(declaration.getType());

        declaration.getProperties().forEach(p => addImport(p.getType()));
        declaration.getMethods().forEach(m => {
            m.getParameters().forEach(p => addImport(p.getType()));
            addImport(m.getReturnType());
        });
        declaration.getHeritageClauses().forEach(hc => {
            hc.getTypeNodes().forEach(tn => addImport(tn.getType()));
        });

        if (implClass) {
            implClass.getProperties().forEach(p => {
                addImport(p.getType());
            });
            
            implClass.getMethods().forEach(m => {
                m.getParameters().forEach(p => addImport(p.getType()));
                addImport(m.getReturnType());
            });
            
            implClass.getHeritageClauses().forEach(hc => {
                hc.getTypeNodes().forEach(tn => addImport(tn.getType()));
            });
            
            const implText = implClass.getFullText();
            
            const typePatterns = [
                /\bas\s+(\w+)/g,
                /:\s*(\w+)\s*[|\&?\[\]]/g,
                /new\s+(\w+)\s*\(/g,
            ];
            
            const functionCallPatterns = [
                /(\w+)\s*\(/g,
            ];
            
            const potentialTypes = new Set<string>();
            const potentialFunctions = new Set<string>();
            
            typePatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(implText)) !== null) {
                    const typeName = match[1];
                    if (typeName && /^[A-Z]/.test(typeName)) {
                        potentialTypes.add(typeName);
                    }
                }
            });
            
            functionCallPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(implText)) !== null) {
                    const functionName = match[1];
                    const builtInFunctions = ['console', 'parseInt', 'parseFloat', 'isNaN', 'Array', 'Object', 'JSON', 'Math', 'Date', 'String', 'Number', 'Boolean', 'Error', 'Promise', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'];
                    const commonMethods = ['push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'join', 'split', 'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'includes', 'indexOf', 'toString', 'valueOf', 'hasOwnProperty', 'length', 'test', 'match', 'replace', 'trim', 'toLowerCase', 'toUpperCase'];
                    
                    if (functionName && 
                        !builtInFunctions.includes(functionName) && 
                        !commonMethods.includes(functionName) &&
                        !/^[A-Z]/.test(functionName) &&
                        functionName !== 'super' &&
                        functionName !== 'this' &&
                        functionName.length > 1) {
                        potentialFunctions.add(functionName);
                    }
                }
            });
            
            potentialTypes.forEach(typeName => {
                let found = false;
                for (const [importPath, importedTypes] of namedImportsMap.entries()) {
                    if (importedTypes.has(typeName)) {
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    for (const [importPath, importedTypes] of typeOnlyImports.entries()) {
                        if (importedTypes.has(typeName)) {
                            found = true;
                            break;
                        }
                    }
                }
                
                if (!found) {
                    if (typeName === 'Customer') {
                        const customerImportPath = '../entity/customer';
                        if (!namedImportsMap.has(customerImportPath)) {
                            namedImportsMap.set(customerImportPath, new Set());
                        }
                        namedImportsMap.get(customerImportPath)!.add('Customer');
                    }
                }
            });
            
            potentialFunctions.forEach(functionName => {
                let found = false;
                
                for (const [importPath, importedNames] of namedImportsMap.entries()) {
                    if (importedNames.has(functionName)) {
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    for (const [importPath, defaultImportName] of defaultImportsMap.entries()) {
                        if (defaultImportName === functionName) {
                            found = true;
                            break;
                        }
                    }
                }
                
                if (!found) {
                    for (const [importPath, namespaceImportName] of namespaceImportsMap.entries()) {
                        if (implText.includes(`${namespaceImportName}.${functionName}`)) {
                            found = true;
                            break;
                        }
                    }
                }
                
                if (!found) {
                    const originalSourceFile = declaration.getSourceFile();
                    originalSourceFile.getImportDeclarations().forEach((importDecl: import("ts-morph").ImportDeclaration) => {
                        const moduleSpecifier = importDecl.getModuleSpecifierValue();
                        
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
                                found = true;
                            }
                        });
                        
                        const defaultImport = importDecl.getDefaultImport();
                        if (defaultImport && defaultImport.getText() === functionName) {
                            const importPath = moduleSpecifier;
                            defaultImportsMap.set(importPath, functionName);
                            found = true;
                        }
                    });
                }
            });
        }

        sourceFile.getImportDeclarations().forEach(importDecl => importDecl.remove());

        for (const [moduleSpecifier, defaultImportName] of defaultImportsMap.entries()) {
            sourceFile.insertImportDeclaration(0, {
                moduleSpecifier,
                defaultImport: defaultImportName,
            });
        }
        
        for (const [moduleSpecifier, namespaceImportName] of namespaceImportsMap.entries()) {
            sourceFile.insertImportDeclaration(0, {
                moduleSpecifier,
                namespaceImport: namespaceImportName,
            });
        }
        
        for (const [moduleSpecifier, names] of namedImportsMap.entries()) {
            if (names.size > 0) {
                sourceFile.insertImportDeclaration(0, {
                    moduleSpecifier,
                    namedImports: Array.from(names),
                });
            }
        }
        
        for (const [moduleSpecifier, names] of typeOnlyImports.entries()) {
            if (names.size > 0) {
                sourceFile.insertImportDeclaration(0, {
                    moduleSpecifier,
                    namedImports: Array.from(names).map(name => ({ name, isTypeOnly: true })),
                });
            }
        }

        if (Node.isClassDeclaration(declaration) && declaration.isAbstract()) {
            const interfaceName = declaration.getName();
            if (interfaceName) {
                const implementsRegex = new RegExp(`implements\s+${interfaceName}`, 'g');
                code = code.replace(implementsRegex, `extends ${interfaceName}`);
            }

            const baseProperties = new Set(declaration.getProperties().map(p => p.getName()));
            implClass.getProperties().forEach(prop => {
                if (baseProperties.has(prop.getName())) {
                    prop.remove();
                }
            });
        }

        return sourceFile.getFullText();
    }

    public async validateGeneratedCode(
        code: string,
        originalDeclaration: InterfaceDeclaration | ClassDeclaration,
        generatedFilePath: string
    ): Promise<{ isValid: boolean; errors: string[] }> {
        const project = originalDeclaration.getProject();
        const tempSourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });

        try {
            const diagnostics = tempSourceFile.getPreEmitDiagnostics();

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
            project.removeSourceFile(tempSourceFile);
        }
    }

    public async fixGeneratedCode(
        originalCode: string,
        declaration: ClassDeclaration | InterfaceDeclaration,
        implFilePath: string,
        originalImportPath: string,
        interfaceName: string,
        validationErrors: string[],
        model: string,
        verbose: boolean,
        provider?: string,
        maxRetries: number = 3
    ): Promise<CodeFixResult> {
        if (verbose) {
            console.log(`  -> WARNING: Generated code for ${interfaceName} failed validation. Attempting to fix with ${provider || 'ollama'}...`);
            validationErrors.forEach(err => console.log(`    - ${err}`));
        }
        
        let retryCount = 0;
        let currentCode = originalCode;
        let isValid = false;
        let errors = validationErrors;
        
        while (!isValid && retryCount < maxRetries) {
            retryCount++;
            if (verbose) {
                console.log(`  -> Retry attempt ${retryCount}/${maxRetries} for ${interfaceName}...`);
            }
            
            try {
                const { dependenciesText } = await this.dependencyAnalysisService.getDependencyInfo(declaration, implFilePath);
                const fixPrompt = generateFixPrompt(
                    declaration,
                    dependenciesText,
                    currentCode,
                    errors,
                    provider
                );
                
                const fixedResponse = await this.modelCallerService.callModel(fixPrompt, `${interfaceName}-fix-${retryCount}`, model, verbose, provider);
                const fixedCode = this.cleanGeneratedCode(fixedResponse, interfaceName, verbose);
                const fixedProcessedCode = this.postProcessGeneratedCode(fixedCode, declaration, implFilePath);
                
                const validationResult = await this.validateGeneratedCode(fixedProcessedCode, declaration, implFilePath);
                isValid = validationResult.isValid;
                errors = validationResult.errors;
                
                if (isValid) {
                    if (verbose) {
                        console.log(`  -> SUCCESS: Code fixed on attempt ${retryCount}`);
                    }
                    return {
                        success: true,
                        fixedCode: fixedProcessedCode,
                        attempts: retryCount
                    };
                } else {
                    if (verbose) {
                        console.log(`  -> Attempt ${retryCount} failed. Errors:`);
                        errors.forEach(err => console.log(`    - ${err}`));
                    }
                    currentCode = fixedProcessedCode;
                }
            } catch (error) {
                if (verbose) {
                    console.error(`  -> Error during retry attempt ${retryCount}: ${error}`);
                }
            }
        }
        
        if (verbose) {
            console.error(`  -> ERROR: Generated code for ${interfaceName} failed validation after ${maxRetries} retry attempts.`);
            if (verbose) {
                console.log("--- FINAL FAILED CODE ---" );
                console.log(currentCode);
                console.log("-------------------------");
            }
        }
        
        return {
            success: false,
            attempts: retryCount,
            errors: errors
        };
    }
}