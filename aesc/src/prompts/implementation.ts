import { InterfaceDeclaration, ClassDeclaration, Node } from "ts-morph";

function _generateCommonRules(
    interfaceName: string,
    config: { action: string; target: string; methodType: string; propertyRule: string },
    additionalRules: string[] = []
): string {
    const rules = [
        `The implementation class name must be '${interfaceName}Impl'.`,
        `The implementation class MUST '${config.action}' the original ${config.target} '${interfaceName}'.`,
        `You MUST implement all ${config.methodType} directly. Do NOT create private helper methods for the core logic.`,
        `${config.propertyRule}`,
        `IMPORTANT: Do NOT create unnecessary temporary objects for validation or processing. Validate data directly using appropriate methods (e.g., regex for email validation, direct string/number checks).`
    ];

    rules.push(...additionalRules);

    rules.push(`Your response MUST be only the raw TypeScript code. No explanations, no markdown.`);
    
    const rulesText = rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');

    return `You must follow these rules strictly:\n${rulesText}`;
}

export function generatePrompt(
    declaration: InterfaceDeclaration | ClassDeclaration,
    dependenciesText: string,
    originalCode: string,
    provider?: string
): string {
    const interfaceName = declaration.getName();
    if (!interfaceName) {
        throw new Error("Cannot generate implementation for an anonymous class or interface.");
    }

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
    const commonRules = _generateCommonRules(interfaceName, config);
    const prompt = `You are a TypeScript code generation engine.
Your task is to ${config.task}.
${commonRules}

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
    dependenciesText: string,
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
    const additionalRules = [
        'Fix all validation errors listed below.',
        isTruncated 
            ? 'COMPLETE the truncated/incomplete code - ensure ALL methods are fully implemented with proper closing braces.' 
            : 'Ensure the code is complete and syntactically correct.'
    ];

    const commonRules = _generateCommonRules(interfaceName, config, additionalRules);

    const fixPrompt = `You are a TypeScript code generation engine.
Your task is to fix the following ${config.target} implementation that has validation errors.

${commonRules}

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
