import { InterfaceDeclaration, ClassDeclaration } from "ts-morph";

export function cleanGeneratedCode(
    rawResponse: string,
    interfaceName: string,
    verbose: boolean
): string {
    let cleanedResponse = rawResponse.trim();
    
    // Extract TypeScript code block if present
    const tsBlockRegex = /```typescript\s*([\s\S]*?)\s*```/;
    const match = cleanedResponse.match(tsBlockRegex);
    if (match && match[1]) {
        cleanedResponse = match[1].trim();
    }

    // New logic to extract only the desired Impl class
    const implClassName = `${interfaceName}Impl`;
    const classRegex = new RegExp(`(export\\s+class\\s+${implClassName}[\\s\\S]*?\\n\\})`, 'm');
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
        cleanedCode = cleanedResponse; // Fallback to the old behavior
    }

    if (verbose) {
        console.log("--- CODE BEFORE POST-PROCESSING ---");
        console.log(cleanedCode);
        console.log("---------------------------------");
    }

    return cleanedCode;
}
