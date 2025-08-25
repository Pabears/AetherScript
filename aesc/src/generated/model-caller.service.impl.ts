import { ModelCallerService } from '../services/model-caller-service';
import { ProviderManager, type ProviderOptions } from '../providers';

/**
 * @class ModelCallerServiceImpl
 * @description
 * Concrete implementation of the ModelCallerService.
 * It uses the ProviderFactoryService to create and manage providers
 * for making calls to language models.
 */
export class ModelCallerServiceImpl extends ModelCallerService {
    private readonly providerManager: ProviderManager;

    constructor() {
        super();
        this.providerManager = new ProviderManager();
        this.providerManager.loadFromEnvironment();
    }

    public async callOllamaModel(
        prompt: string,
        interfaceName: string,
        model: string,
        verbose: boolean,
        providerName?: string,
        providerOptions?: ProviderOptions
    ): Promise<string> {
        try {
            const { provider, config } = this.providerManager.createProvider(providerName);

            const options: ProviderOptions = {
                verbose,
                endpoint: config.settings.endpoint,
                auth: config.settings.auth,
                ...config.settings,
                ...providerOptions,
            };

            const modelToUse = model || config.defaultModel || 'qwen3-coder';

            console.log(`  -> Using provider: ${provider.name} with model: ${modelToUse}`);

            return await provider.generate(prompt, modelToUse, options);
        } catch (error) {
            console.error(`Failed to generate code using provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    public callModel(
        prompt: string,
        interfaceName: string,
        model: string,
        verbose: boolean,
        providerName?: string,
        providerOptions?: ProviderOptions
    ): Promise<string> {
        return this.callOllamaModel(prompt, interfaceName, model, verbose, providerName, providerOptions);
    }

    public getProviderManager(): ProviderManager {
        return this.providerManager;
    }

    public configureProvider(
        name: string,
        type: string,
        settings: Record<string, any>,
        defaultModel?: string
    ): void {
        this.providerManager.setProviderConfig(name, {
            type,
            defaultModel,
            settings
        });
    }

    public setDefaultProvider(providerName: string): void {
        this.providerManager.setDefaultProvider(providerName);
    }

    public listProviders(): { available: string[]; configured: string[] } {
        const { ProviderFactory } = require('../providers');
        return {
            available: ProviderFactory.getAvailableProviders(),
            configured: this.providerManager.getConfiguredProviders()
        };
    }
}