import { CodeGenerationService } from '../services/CodeGenerationService';
import type { ProcessGeneratedCodeParams, ProcessGeneratedCodeResult } from '../services/types';
import { Project, Node, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import * as ts from 'typescript';
import * as path from 'path';
import { generateFixPrompt, generatePrompt } from '../prompts/implementation';
import { container } from './container'; // For service location

// --- All code generation logic is consolidated here ---

// From code-cleaner.ts
function cleanGeneratedCode(rawResponse: string, interfaceName: string, verbose: boolean): string {
    let cleanedResponse = rawResponse.trim();
    const tsBlockRegex = /```typescript\s*([\s\S]*?)\s*```/;
    const match = cleanedResponse.match(tsBlockRegex);
    if (match && match[1]) {
        cleanedResponse = match[1].trim();
    }
    const implClassName = `${interfaceName}Impl`;
    const classRegex = new RegExp(`(export\\s+class\\s+${implClassName}[\\s\\S]*?\\n\\})`, 'm');
    const classMatch = cleanedResponse.match(classRegex);
    let cleanedCode: string;
    if (classMatch && classMatch[0]) {
        cleanedCode = classMatch[0];
        if (verbose) console.log(`  -> INFO: Extracted '${implClassName}' from response.`);
    } else {
        if (verbose) console.log(`  -> WARN: Could not extract '${implClassName}' from response. Using the full response as fallback.`);
        cleanedCode = cleanedResponse;
    }
    if (verbose) {
        console.log("--- CODE BEFORE POST-PROCESSING ---");
        console.log(cleanedCode);
        console.log("---------------------------------");
    }
    return cleanedCode;
}

// From post-processor.ts
function postProcessGeneratedCode(code: string, declaration: InterfaceDeclaration | ClassDeclaration, generatedFilePath: string): string {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });
    const interfaceName = declaration.getName()!;
    const implName = `${interfaceName}Impl`;
    if (Node.isClassDeclaration(declaration) && declaration.isAbstract()) {
        const className = declaration.getName()!;
        const implementsRegex = new RegExp(`(implements\\s+)${className}`, 'g');
        code = code.replace(implementsRegex, `extends ${className}`);
        sourceFile.replaceWithText(code);
    }
    const implClass = sourceFile.getClass(implName);
    if (!implClass) return code;

    // Import fixing logic (simplified for brevity, full logic is complex)
    const originalSourceFile = declaration.getSourceFile();
    sourceFile.getImportDeclarations().forEach(importDecl => importDecl.remove());
    originalSourceFile.getImportDeclarations().forEach(importDecl => {
        const structure = importDecl.getStructure();
        if (structure.moduleSpecifier.startsWith('.')) {
            const originalDir = path.dirname(originalSourceFile.getFilePath());
            const absoluteImportPath = path.resolve(originalDir, structure.moduleSpecifier);
            const relativePath = path.relative(path.dirname(generatedFilePath), absoluteImportPath).replace(/\\/g, '/');
            structure.moduleSpecifier = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        }
        sourceFile.insertImportDeclaration(0, structure);
    });

    if (Node.isClassDeclaration(declaration) && declaration.isAbstract()) {
        const baseProperties = new Set(declaration.getProperties().map(p => p.getName()));
        implClass.getProperties().forEach(prop => {
            if (baseProperties.has(prop.getName())) prop.remove();
        });
    }
    return sourceFile.getFullText();
}

async function validateGeneratedCode(code: string, originalDeclaration: InterfaceDeclaration | ClassDeclaration, generatedFilePath: string): Promise<{ isValid: boolean; errors: string[] }> {
    const project = originalDeclaration.getProject();
    const tempSourceFile = project.createSourceFile(generatedFilePath, code, { overwrite: true });
    try {
        const diagnostics = tempSourceFile.getPreEmitDiagnostics();
        const flattenMessages = (chain: any): string => {
            let result = chain.getMessageText();
            const next = chain.getNext();
            if (next) next.forEach((nextChain: any) => { result += ` -> ${flattenMessages(nextChain)}`; });
            return result;
        };
        if (diagnostics.length > 0) {
            const errors = diagnostics.map(d => typeof d.getMessageText() === 'string' ? d.getMessageText() as string : flattenMessages(d.getMessageText())).filter(error => !error.includes("Object is possibly 'undefined'"));
            if (errors.length > 0) return { isValid: false, errors };
        }
        return { isValid: true, errors: [] };
    } finally {
        project.removeSourceFile(tempSourceFile);
    }
}

// From code-fixer.ts
async function fixGeneratedCode(originalCode: string, declaration: ClassDeclaration | InterfaceDeclaration, implFilePath: string, originalImportPath: string, interfaceName: string, validationErrors: string[], model: string, verbose: boolean, providerName?: string, maxRetries: number = 3): Promise<{ success: boolean; fixedCode?: string; attempts: number; errors?: string[]; }> {
    const providerService = container.get('ProviderService');
    const dependencyAnalysisService = container.get('DependencyAnalysisService');

    if (verbose) {
        console.log(`  -> WARNING: Generated code for ${interfaceName} failed validation. Attempting to fix...`);
        validationErrors.forEach(err => console.log(`    - ${err}`));
    }
    let retryCount = 0;
    let currentCode = originalCode;
    let isValid = false;
    let errors = validationErrors;
    while (!isValid && retryCount < maxRetries) {
        retryCount++;
        if (verbose) console.log(`  -> Retry attempt ${retryCount}/${maxRetries} for ${interfaceName}...`);
        try {
            const { dependenciesText } = dependencyAnalysisService.generateDependencyInfo(declaration, originalImportPath, implFilePath);
            const fixPrompt = generateFixPrompt(declaration, dependenciesText, currentCode, errors, providerName);

            const { provider, config } = providerService.createProvider(providerName);
            const fixedResponse = await provider.generate(fixPrompt, model || config.defaultModel || 'codellama', { verbose });

            const fixedCode = cleanGeneratedCode(fixedResponse, interfaceName, verbose);
            const fixedProcessedCode = postProcessGeneratedCode(fixedCode, declaration, implFilePath);
            const validationResult = await validateGeneratedCode(fixedProcessedCode, declaration, implFilePath);
            isValid = validationResult.isValid;
            errors = validationResult.errors;
            if (isValid) {
                if (verbose) console.log(`  -> SUCCESS: Code fixed on attempt ${retryCount}`);
                return { success: true, fixedCode: fixedProcessedCode, attempts: retryCount };
            } else {
                if (verbose) {
                    console.log(`  -> Attempt ${retryCount} failed. Errors:`);
                    errors.forEach(err => console.log(`    - ${err}`));
                }
                currentCode = fixedProcessedCode;
            }
        } catch (error) {
            if (verbose) console.error(`  -> Error during retry attempt ${retryCount}: ${error}`);
        }
    }
    if (verbose) {
        console.error(`  -> ERROR: Generated code for ${interfaceName} failed validation after ${maxRetries} retry attempts.`);
    }
    return { success: false, attempts: retryCount, errors: errors };
}

/**
 * Concrete implementation of the CodeGenerationService.
 */
export class CodeGenerationServiceImpl implements CodeGenerationService {

    public async processGeneratedCode(params: ProcessGeneratedCodeParams): Promise<ProcessGeneratedCodeResult> {
        const providerService = container.get('ProviderService');
        const dependencyAnalysisService = container.get('DependencyAnalysisService');

        try {
            const cleanedCode = cleanGeneratedCode(params.rawCode, params.interfaceName, params.verbose || false);
            let processedCode = postProcessGeneratedCode(cleanedCode, params.declaration, params.implFilePath);

            if (params.verbose) {
                console.log("--- CODE AFTER POST-PROCESSING ---");
                console.log(processedCode);
                console.log("--------------------------------");
            }

            let { isValid, errors } = await validateGeneratedCode(processedCode, params.declaration, params.implFilePath);

            if (!isValid) {
                const fixResult = await fixGeneratedCode(
                    processedCode,
                    params.declaration,
                    params.implFilePath,
                    params.originalImportPath,
                    params.interfaceName,
                    errors,
                    params.model,
                    params.verbose || false,
                    params.provider
                );

                if (fixResult.success && fixResult.fixedCode) {
                    return { success: true, processedCode: fixResult.fixedCode, attempts: fixResult.attempts };
                } else {
                    return { success: false, errors, attempts: fixResult.attempts };
                }
            }

            return { success: true, processedCode };
        } catch (error) {
            return { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] };
        }
    }
}
