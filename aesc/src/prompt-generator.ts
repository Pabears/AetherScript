import { InterfaceDeclaration, ClassDeclaration, Node, ts } from "ts-morph";
import * as path from 'path';

export function generatePrompt(
    declaration: InterfaceDeclaration | ClassDeclaration, 
    originalImportPath: string, 
    generatedFilePath: string
): string {
    const interfaceName = declaration.getName();
    if (!interfaceName) {
        throw new Error("Cannot generate implementation for an anonymous class or interface.");
    }

    const dependentTypes = new Map<string, { path: string, code: string }>();

    const addDependencies = (node: Node) => {
        if (!node || !node.getSourceFile) return;
        const sourceFile = node.getSourceFile();
        if (sourceFile.isFromExternalLibrary() || sourceFile.isDeclarationFile()) return;

        const types = node.getDescendantsOfKind(ts.SyntaxKind.TypeReference);
        types.forEach(typeRef => {
            const symbol = typeRef.getType().getSymbol();
            if (symbol) {
                const name = symbol.getName();
                if (['Promise', 'void', 'string', 'number', 'boolean', 'any', 'unknown', 'never'].includes(name) || dependentTypes.has(name)) return;
                for (const decl of symbol.getDeclarations()) {
                    const declSourceFile = decl.getSourceFile();
                    if (declSourceFile && !declSourceFile.isFromExternalLibrary()) {
                        const importPath = path.relative(path.dirname(generatedFilePath), declSourceFile.getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');
                        dependentTypes.set(name, { path: importPath, code: decl.getText() });
                        addDependencies(decl);
                    }
                }
            }
        });
    };

    addDependencies(declaration);

    const dependenciesText = Array.from(dependentTypes.entries())
        .map(([_, { path, code }]) => `// From: ${path}\n${code}`)
        .join('\n\n');

    const originalCode = declaration.getText();
    const fixedOriginalCode = originalCode.replace(/\.len\b/g, '.length');

    // This is the new, much stricter prompt
    const prompt = `You are a TypeScript code generation engine.
Your task is to implement the following abstract class.
You must follow these rules strictly:
1. The implementation class name must be '${interfaceName}Impl'.
2. The implementation class MUST 'extend' the original abstract class '${interfaceName}'.
3. You MUST implement all abstract methods directly. Do NOT create private helper methods for the core logic.
4. You MUST NOT redeclare any properties already present in the base class. Access them with 'this'.
5. Your response MUST be only the raw TypeScript code. No explanations, no markdown.

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
