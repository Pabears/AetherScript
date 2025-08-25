import type { ModelProvider, ProviderConfig } from './base-provider';
import { OllamaProvider } from './ollama-provider';
import { CloudflareProvider } from './cloudflare-provider';

/**
 * Factory for creating model provider instances
 */
export class ProviderFactory {
    private static providers = new Map<string, () => ModelProvider>([
        ['ollama', () => new OllamaProvider()],
        ['cloudflare', () => new CloudflareProvider()],
    ]);

    /**
     * Create a provider instance by type
     */
    static createProvider(type: string): ModelProvider {
        const providerFactory = this.providers.get(type.toLowerCase());
        if (!providerFactory) {
            throw new Error(`Unknown provider type: ${type}. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        return providerFactory();
    }

    /**
     * Register a new provider type
     */
    static registerProvider(type: string, factory: () => ModelProvider): void {
        this.providers.set(type.toLowerCase(), factory);
    }

    /**
     * Get list of available provider types
     */
    static getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }
}

/**
 * Provider manager handles configuration and provider selection
 */
export class ProviderManager {
    private configs = new Map<string, ProviderConfig>();
    private defaultProvider = 'ollama';

    constructor() {
        // Set up default Ollama configuration for backward compatibility
        this.configs.set('ollama', {
            type: 'ollama',
            defaultModel: 'qwen3-coder',
            settings: {
                endpoint: 'http://localhost:11434/api/generate'
            }
        });
    }

    /**
     * Add or update provider configuration
     */
    setProviderConfig(name: string, config: ProviderConfig): void {
        this.configs.set(name, config);
    }

    /**
     * Get provider configuration by name
     */
    getProviderConfig(name: string): ProviderConfig | undefined {
        return this.configs.get(name);
    }

    /**
     * Set default provider
     */
    setDefaultProvider(name: string): void {
        if (!this.configs.has(name)) {
            throw new Error(`Provider '${name}' is not configured`);
        }
        this.defaultProvider = name;
    }

    /**
     * Get default provider name
     */
    getDefaultProvider(): string {
        return this.defaultProvider;
    }

    /**
     * Create a provider instance with configuration
     */
    createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig } {
        const providerName = name || this.defaultProvider;
        const config = this.configs.get(providerName);
        
        if (!config) {
            throw new Error(`No configuration found for provider: ${providerName}`);
        }

        const provider = ProviderFactory.createProvider(config.type);
        return { provider, config };
    }

    /**
     * Load configuration from environment variables or config file
     */
    loadFromEnvironment(): void {
        // Load Cloudflare configuration from environment
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

        // Load custom Ollama endpoint from environment
        if (process.env.OLLAMA_ENDPOINT) {
            const ollamaConfig = this.configs.get('ollama');
            if (ollamaConfig) {
                ollamaConfig.settings.endpoint = process.env.OLLAMA_ENDPOINT;
            }
        }
    }

    /**
     * Get all configured providers
     */
    getConfiguredProviders(): string[] {
        return Array.from(this.configs.keys());
    }
}
