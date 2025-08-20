import { ProviderService } from '../services/provider-service';
import { ModelProvider, ProviderConfig, ProviderOptions } from '../providers/base-provider';
import { ProviderFactory, ProviderManager } from '../providers';

/**
 * Concrete implementation of the ProviderService.
 * It wraps the original ProviderFactory and ProviderManager.
 */
export class ProviderServiceImpl extends ProviderService {
    private manager: ProviderManager;

    constructor() {
        super();
        this.manager = new ProviderManager();
        this.manager.loadFromEnvironment();
    }

    registerProvider(type: string, factory: () => ModelProvider): void {
        ProviderFactory.registerProvider(type, factory);
    }

    getAvailableProviders(): string[] {
        return ProviderFactory.getAvailableProviders();
    }

    setProviderConfig(name: string, config: ProviderConfig): void {
        this.manager.setProviderConfig(name, config);
    }

    getProviderConfig(name: string): ProviderConfig | undefined {
        return this.manager.getProviderConfig(name);
    }

    getConfiguredProviders(): string[] {
        return this.manager.getConfiguredProviders();
    }

    setDefaultProvider(name: string): void {
        this.manager.setDefaultProvider(name);
    }

    getDefaultProvider(): string {
        return this.manager.getDefaultProvider();
    }

    createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig } {
        return this.manager.createProvider(name);
    }

    loadFromEnvironment(): void {
        this.manager.loadFromEnvironment();
    }
}
