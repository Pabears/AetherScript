import type { ModelProvider, ProviderOptions } from './base-provider';

/**
 * Ollama provider implementation
 * Supports local and remote Ollama instances
 */
export class OllamaProvider implements ModelProvider {
    readonly name = 'ollama';
    private defaultEndpoint = 'http://localhost:11434/api/generate';

    async generate(prompt: string, model: string, options?: ProviderOptions): Promise<string> {
        const endpoint = options?.endpoint || this.defaultEndpoint;
        const timeout = options?.timeout || 600000; // 10 minutes default for LLM responses
        
        if (options?.verbose) {
            console.log("--- OLLAMA PROMPT ---");
            console.log(prompt);
            console.log("---------------------");
        }

        console.log(`  -> Sending prompt to Ollama (${endpoint}) for model ${model}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
                body: JSON.stringify({ 
                    model, 
                    prompt, 
                    stream: false 
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ollama request failed with status ${response.status}: ${response.statusText}`);
            }

            const ollamaResponse = await response.json() as { response: string };
            
            if (options?.verbose) {
                console.log("--- OLLAMA RESPONSE (RAW) ---");
                console.log(ollamaResponse.response);
                console.log("----------------------------");
            }

            return ollamaResponse.response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Ollama request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    async validateConnection(): Promise<void> {
        try {
            const response = await fetch(`${this.defaultEndpoint.replace('/api/generate', '/api/tags')}`, {
                method: 'GET',
            });
            
            if (!response.ok) {
                throw new Error(`Ollama connection failed: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Cannot connect to Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.defaultEndpoint.replace('/api/generate', '/api/tags')}`, {
                method: 'GET',
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json() as { models: Array<{ name: string }> };
            return data.models.map(model => model.name);
        } catch (error) {
            console.warn('Failed to fetch available models:', error);
            return [];
        }
    }
}
