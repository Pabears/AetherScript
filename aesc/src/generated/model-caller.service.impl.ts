import { ModelCallerService } from '../services/model-caller-service';
import type { ProviderFactoryService } from '../services/provider-factory-service';
import type { ProviderOptions } from '../types';

/**
 * @class ModelCallerServiceImpl
 * @description
 * Concrete implementation of the ModelCallerService.
 * It uses the ProviderFactoryService to create and manage providers
 * for making calls to language models.
 */
export class ModelCallerServiceImpl extends ModelCallerService {
    constructor(private readonly providerFactoryService: ProviderFactoryService) {
        super();
    }

    public async callModel(
        prompt: string,
        loggingContext: string, // interfaceName in original code
        model: string,
        verbose: boolean,
        providerName?: string,
        providerOptions?: ProviderOptions
    ): Promise<string> {
        try {
            const { provider, config } = this.providerFactoryService.createProvider(providerName);
            
            const options: ProviderOptions = {
                verbose,
                endpoint: config.settings.endpoint,
                auth: config.settings.auth,
                ...config.settings,
                ...providerOptions,
            };

            const modelToUse = model || config.defaultModel || 'codellama';

            console.log(`  -> Using provider: ${provider.name} with model: ${modelToUse}`);
            
            return await provider.generate(prompt, modelToUse, options);
        } catch (error) {
            console.error(`Failed to generate code using provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    public configureProvider(
        name: string,
        type: string,
        settings: Record<string, any>,
        defaultModel?: string
    ): void {
        this.providerFactoryService.setProviderConfig(name, {
            type,
            defaultModel,
            settings
        });
    }

    public setDefaultProvider(providerName: string): void {
        this.providerFactoryService.setDefaultProvider(providerName);
    }

    public listProviders(): { available: string[]; configured: string[] } {
        return {
            available: this.providerFactoryService.getAvailableProviders(),
            configured: this.providerFactoryService.getConfiguredProviders()
        };
    }
}