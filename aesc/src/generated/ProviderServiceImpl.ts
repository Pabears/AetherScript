import { ProviderService } from '../services/ProviderService';
import type { ModelProvider, ProviderConfig, ProviderOptions } from '../services/types';

// --- Provider Implementations moved here to be self-contained ---

/**
 * Ollama provider implementation
 */
class OllamaProvider implements ModelProvider {
    readonly name = 'ollama';
    private defaultEndpoint = 'http://localhost:11434/api/generate';

    async generate(prompt: string, model: string, options?: ProviderOptions): Promise<string> {
        const endpoint = options?.endpoint || this.defaultEndpoint;
        const timeout = options?.timeout || 600000;

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
                headers: { 'Content-Type': 'application/json', ...options?.headers },
                body: JSON.stringify({ model, prompt, stream: false }),
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
            const response = await fetch(`${this.defaultEndpoint.replace('/api/generate', '/api/tags')}`, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`Ollama connection failed: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Cannot connect to Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.defaultEndpoint.replace('/api/generate', '/api/tags')}`, { method: 'GET' });
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

/**
 * Cloudflare Workers AI provider implementation
 */
class CloudflareProvider implements ModelProvider {
    readonly name = 'cloudflare';

    async generate(prompt: string, model: string, options?: ProviderOptions): Promise<string> {
        if (!options?.endpoint) {
            throw new Error('Cloudflare provider requires an endpoint URL');
        }
        const timeout = options?.timeout || 600000;

        if (options?.verbose) {
            console.log("--- CLOUDFLARE PROMPT ---");
            console.log(prompt);
            console.log("-------------------------");
        }
        console.log(`  -> Sending prompt to Cloudflare Workers AI for model ${model}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options?.headers };
            if (options?.auth) {
                Object.entries(options.auth).forEach(([key, value]) => { headers[key] = value; });
            }

            const response = await fetch(options.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prompt, stream: false, ...this.getCloudflareSpecificOptions(options) }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Cloudflare request failed with status ${response.status}: ${errorText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            const isStreaming = contentType.includes('text/event-stream') || contentType.includes('text/plain') || response.headers.get('transfer-encoding') === 'chunked';
            let generatedText: string;

            if (isStreaming) {
                const fullResponse = await response.text();
                 if (contentType.includes('text/event-stream')) {
                    const lines = fullResponse.split('\n');
                    let combinedResponse = '';
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                if (data.response) combinedResponse += data.response;
                                else if (data.generated_text) combinedResponse += data.generated_text;
                            } catch (e) { continue; }
                        }
                    }
                    generatedText = combinedResponse;
                } else {
                    try {
                        const parsed = JSON.parse(fullResponse);
                        generatedText = parsed.result?.response || parsed.result?.generated_text || parsed.response || parsed.generated_text || fullResponse;
                    } catch {
                        generatedText = fullResponse;
                    }
                }
            } else {
                const cloudflareResponse = await response.json() as any;
                generatedText = cloudflareResponse.result?.response || cloudflareResponse.result?.generated_text || cloudflareResponse.response || cloudflareResponse.generated_text || '';
            }

            if (!generatedText) throw new Error('No generated text found in Cloudflare response');

            if (options?.verbose) {
                console.log("--- CLOUDFLARE RESPONSE (RAW) ---");
                console.log(generatedText);
                console.log("--------------------------------");
            }
            return generatedText;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Cloudflare request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    async validateConnection(): Promise<void> {
        if (!process.env.CLOUDFLARE_ACCOUNT_ID && !process.env.CLOUDFLARE_API_TOKEN) {
            console.warn('Cloudflare provider: No environment variables found. Make sure to provide endpoint and auth in options.');
        }
    }

    private getCloudflareSpecificOptions(options?: ProviderOptions): Record<string, any> {
        const cloudflareOptions: Record<string, any> = { stream: false, max_tokens: 20480 };
        if (options?.max_tokens) cloudflareOptions.max_tokens = Math.min(options.max_tokens, 20480);
        if (options?.temperature) cloudflareOptions.temperature = options.temperature;
        if (options?.top_p) cloudflareOptions.top_p = options.top_p;
        return cloudflareOptions;
    }

    async getAvailableModels(): Promise<string[]> {
        return ['@cf/meta/llama-2-7b-chat-int8', '@cf/meta/llama-2-7b-chat-fp16', '@cf/mistral/mistral-7b-instruct-v0.1', '@cf/qwen/qwen2.5-coder-32b-instruct', '@cf/deepseek-ai/deepseek-math-7b-instruct', '@cf/thebloke/codellama-7b-instruct-awq'];
    }
}

// --- Service Implementation ---

class ProviderFactory {
    private static providers = new Map<string, () => ModelProvider>([
        ['ollama', () => new OllamaProvider()],
        ['cloudflare', () => new CloudflareProvider()],
    ]);

    static createProvider(type: string): ModelProvider {
        const providerFactory = this.providers.get(type.toLowerCase());
        if (!providerFactory) {
            throw new Error(`Unknown provider type: ${type}. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        return providerFactory();
    }

    static getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }
}

export class ProviderServiceImpl implements ProviderService {
    private configs = new Map<string, ProviderConfig>();
    private defaultProvider = 'ollama';

    constructor() {
        this.configs.set('ollama', {
            type: 'ollama',
            defaultModel: 'codellama',
            settings: { endpoint: 'http://localhost:11434/api/generate' }
        });
        this.loadFromEnvironment();
    }

    public setProviderConfig(name: string, config: ProviderConfig): void {
        this.configs.set(name, config);
    }

    public getProviderConfig(name: string): ProviderConfig | undefined {
        return this.configs.get(name);
    }

    public setDefaultProvider(name: string): void {
        if (!this.configs.has(name)) {
            throw new Error(`Provider '${name}' is not configured`);
        }
        this.defaultProvider = name;
    }

    public getDefaultProvider(): string {
        return this.defaultProvider;
    }

    public createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig } {
        const providerName = name || this.defaultProvider;
        const config = this.configs.get(providerName);
        if (!config) throw new Error(`No configuration found for provider: ${providerName}`);
        const provider = ProviderFactory.createProvider(config.type);
        return { provider, config };
    }

    public loadFromEnvironment(): void {
        if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
            this.configs.set('cloudflare', {
                type: 'cloudflare',
                defaultModel: '@cf/qwen/qwen2.5-coder-32b-instruct',
                settings: {
                    endpoint: `https://gateway.ai.cloudflare.com/v1/${process.env.CLOUDFLARE_ACCOUNT_ID}/hello/workers-ai/@cf/qwen/qwen2.5-coder-32b-instruct`,
                    auth: {
                        'cf-aig-authorization': `Bearer ${process.env.CLOUDFLARE_AIG_TOKEN || ''}`,
                        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`
                    }
                }
            });
        }
        if (process.env.OLLAMA_ENDPOINT) {
            const ollamaConfig = this.configs.get('ollama');
            if (ollamaConfig) ollamaConfig.settings.endpoint = process.env.OLLAMA_ENDPOINT;
        }
    }

    public getAvailableProviders(): string[] {
        return ProviderFactory.getAvailableProviders();
    }

    public getConfiguredProviders(): string[] {
        return Array.from(this.configs.keys());
    }
}
