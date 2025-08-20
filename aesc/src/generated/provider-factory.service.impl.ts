import { ProviderFactoryService } from '../services/provider-factory-service';
import type { ModelProvider, ProviderConfig } from '../providers/base-provider';
import { ProviderManager, ProviderFactory } from '../providers/provider-factory';

/**
 * @class ProviderFactoryServiceImpl
 * @description
 * Concrete implementation of the ProviderFactoryService.
 * It uses the original ProviderManager and ProviderFactory classes from the `src/providers` directory.
 */
export class ProviderFactoryServiceImpl extends ProviderFactoryService {
    private manager: ProviderManager;

    constructor() {
        super();
        // The ProviderManager loads environment variables in its constructor,
        // so we create a new instance to preserve that behavior.
        this.manager = new ProviderManager();
    }

    createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig } {
        return this.manager.createProvider(name);
    }

    setProviderConfig(name: string, config: ProviderConfig): void {
        this.manager.setProviderConfig(name, config);
    }

    getProviderConfig(name: string): ProviderConfig | undefined {
        return this.manager.getProviderConfig(name);
    }

    setDefaultProvider(name: string): void {
        this.manager.setDefaultProvider(name);
    }

    getConfiguredProviders(): string[] {
        return this.manager.getConfiguredProviders();
    }

    getAvailableProviders(): string[] {
        // This method is static on the original ProviderFactory
        return ProviderFactory.getAvailableProviders();
    }
}
