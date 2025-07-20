import { ClassDeclaration, InterfaceDeclaration } from 'ts-morph';
import { callOllamaModel } from '../model-caller';
import { cleanGeneratedCode } from './code-cleaner';
import { postProcessGeneratedCode, validateGeneratedCode } from './post-processor';
import { generatePrompt } from '../prompt-generator';

export interface CodeFixResult {
    success: boolean;
    fixedCode?: string;
    attempts: number;
    errors?: string[];
}

/**
 * Attempts to fix validation errors in generated code using the same model and provider as generation
 */
export async function fixGeneratedCode(
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
            // Create a fix prompt with current code, error messages, and dependency information
            // Re-generate the dependency information for the fix prompt
            const dependencyPrompt = generatePrompt(declaration, originalImportPath, implFilePath, provider);
            
            // Extract the dependency section from the original prompt
            const dependencyMatch = dependencyPrompt.match(/Here are the dependent type definitions:[\s\S]*?```typescript([\s\S]*?)```[\s\S]*?Here is the abstract class/m);
            const dependenciesText = dependencyMatch && dependencyMatch[1] ? dependencyMatch[1].trim() : '';
            
            // Check if code appears to be truncated
            const isTruncated = currentCode.trim().endsWith('//') || 
                               currentCode.trim().endsWith('/*') || 
                               !currentCode.includes('}') ||
                               currentCode.split('{').length !== currentCode.split('}').length;
            
            const fixPrompt = `The following TypeScript code has validation errors${isTruncated ? ' and appears to be incomplete/truncated' : ''}. Please fix the code to resolve these issues.

${dependenciesText ? `Here are the dependent type definitions:
\`\`\`typescript
${dependenciesText}
\`\`\`

` : ''}Current code with errors:
\`\`\`typescript
${currentCode}
\`\`\`

Validation errors:
${errors.map(err => `- ${err}`).join('\n')}

CRITICAL REQUIREMENTS:
1. ${isTruncated ? 'COMPLETE the truncated/incomplete code - ensure ALL methods are fully implemented with proper closing braces' : 'Fix all validation errors listed above'}
2. Implement ALL abstract methods from the parent class/interface completely
3. Use correct import syntax for dependencies (default imports vs named imports)
4. Follow the provided type definitions and API documentation exactly
5. Ensure proper TypeScript syntax with matching braces and complete method implementations
6. Return ONLY the complete, corrected TypeScript code wrapped in \`\`\`typescript code blocks
7. Do NOT include explanations, comments, or text outside the code block

${isTruncated ? 'IMPORTANT: The provided code appears incomplete. Make sure to complete ALL methods and ensure proper code structure.' : ''}

Generate the complete, working TypeScript implementation now:`;
            
            // Use the same model and provider as the original generation
            const fixedResponse = await callOllamaModel(fixPrompt, `${interfaceName}-fix-${retryCount}`, model, verbose, provider);
            const fixedCode = cleanGeneratedCode(fixedResponse, interfaceName, verbose);
            const fixedProcessedCode = postProcessGeneratedCode(fixedCode, declaration, implFilePath);
            
            // Validate the fixed code
            const validationResult = await validateGeneratedCode(fixedProcessedCode, declaration, implFilePath);
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
                currentCode = fixedProcessedCode; // Use the latest attempt for next retry
            }
        } catch (error) {
            if (verbose) {
                console.error(`  -> Error during retry attempt ${retryCount}: ${error}`);
            }
        }
    }
    
    // If still not valid after all retries
    if (verbose) {
        console.error(`  -> ERROR: Generated code for ${interfaceName} failed validation after ${maxRetries} retry attempts.`);
        if (verbose) {
            console.log("--- FINAL FAILED CODE --- ");
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
