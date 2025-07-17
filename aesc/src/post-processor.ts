import { Project, InterfaceDeclaration, ClassDeclaration, Node } from "ts-morph";
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
    const requiredImports = new Map<string, Set<string>>();

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

            if (!requiredImports.has(finalPath)) {
                requiredImports.set(finalPath, new Set());
            }
            requiredImports.get(finalPath)!.add(typeName);
        }
    };

    // Add import for the base class/interface itself
    addImport(declaration.getType());

    // Add imports for all types used in properties, methods, and heritage clauses
    declaration.getProperties().forEach(p => addImport(p.getType()));
    declaration.getMethods().forEach(m => {
        m.getParameters().forEach(p => addImport(p.getType()));
        addImport(m.getReturnType());
    });
    declaration.getHeritageClauses().forEach(hc => {
        hc.getTypeNodes().forEach(tn => addImport(tn.getType()));
    });

    // Remove all existing import declarations
    sourceFile.getImportDeclarations().forEach(importDecl => importDecl.remove());

    // Add the corrected and consolidated imports
    for (const [moduleSpecifier, names] of requiredImports.entries()) {
        sourceFile.insertImportDeclaration(0, {
            moduleSpecifier,
            namedImports: Array.from(names),
        });
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
