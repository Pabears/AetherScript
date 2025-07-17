import { InterfaceDeclaration, ClassDeclaration } from "ts-morph";

export interface OllamaResponse {
    response: string;
}

export async function callOllamaModel(
    prompt: string,
    interfaceName: string,
    model: string,
    verbose: boolean
): Promise<string> {
    if (verbose) {
        console.log("--- OLLAMA PROMPT ---");
        console.log(prompt);
        console.log("---------------------");
    }

    console.log(`  -> Sending prompt to Ollama for ${interfaceName}...`);
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
    });

    if (!response.ok) {
        throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const ollamaResponse = await response.json() as OllamaResponse;
    
    if (verbose) {
        console.log("--- OLLAMA RESPONSE (RAW) ---");
        console.log(ollamaResponse.response);
        console.log("----------------------------");
    }

    return ollamaResponse.response;
}
