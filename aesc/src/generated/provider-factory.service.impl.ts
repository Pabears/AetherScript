import { ProviderFactoryService } from '../services/provider-factory-service';
import type { ModelProvider, ProviderConfig } from '../providers/base-provider';
import { OllamaProvider } from '../providers/ollama-provider';
import { CloudflareProvider } from '../providers/cloudflare-provider';

/**
 * @class ProviderFactoryServiceImpl
 * @description
 * Concrete implementation of the ProviderFactoryService.
 * This class contains the merged logic of the original ProviderFactory and ProviderManager.
 */
export class ProviderFactoryServiceImpl extends ProviderFactoryService {
    // --- Logic from ProviderFactory ---
    private static providers = new Map<string, () => ModelProvider>([
        ['ollama', () => new OllamaProvider()],
        ['cloudflare', () => new CloudflareProvider()],
    ]);

    private static internalCreateProvider(type: string): ModelProvider {
        const providerFactory = this.providers.get(type.toLowerCase());
        if (!providerFactory) {
            throw new Error(`Unknown provider type: ${type}. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
        }
        return providerFactory();
    }

    // --- Logic from ProviderManager ---
    private configs = new Map<string, ProviderConfig>();
    private defaultProvider = 'ollama';

    constructor() {
        super();
        // Set up default Ollama configuration
        this.configs.set('ollama', {
            type: 'ollama',
            defaultModel: 'codellama',
            settings: {
                endpoint: 'http://localhost:11434/api/generate'
            }
        });
        this.loadFromEnvironment();
    }

    // --- Public API Implementation ---

    public createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig } {
        const providerName = name || this.defaultProvider;
        const config = this.configs.get(providerName);
        
        if (!config) {
            throw new Error(`No configuration found for provider: ${providerName}`);
        }

        const provider = ProviderFactoryServiceImpl.internalCreateProvider(config.type);
        return { provider, config };
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

    public getConfiguredProviders(): string[] {
        return Array.from(this.configs.keys());
    }

    public getAvailableProviders(): string[] {
        return Array.from(ProviderFactoryServiceImpl.providers.keys());
    }

    // --- Private Helper Methods ---

    private loadFromEnvironment(): void {
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
}