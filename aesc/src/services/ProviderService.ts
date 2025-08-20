import type { ModelProvider, ProviderConfig } from './types';

/**
 * Abstract class for a provider service.
 * This service is responsible for managing AI model providers, their configurations,
 * and creating instances of them.
 */
export abstract class ProviderService {
    /**
     * Adds or updates the configuration for a given provider.
     * @param name The name of the provider to configure.
     * @param config The configuration object.
     */
    abstract setProviderConfig(name: string, config: ProviderConfig): void;

    /**
     * Retrieves the configuration for a specific provider.
     * @param name The name of the provider.
     * @returns The provider's configuration, or undefined if not found.
     */
    abstract getProviderConfig(name: string): ProviderConfig | undefined;

    /**
     * Sets the default provider to be used when none is specified.
     * @param name The name of the provider to set as default.
     */
    abstract setDefaultProvider(name: string): void;

    /**
     * Gets the name of the default provider.
     * @returns The name of the default provider.
     */
    abstract getDefaultProvider(): string;

    /**
     * Creates an instance of a provider.
     * If no name is provided, the default provider is created.
     * @param name The name of the provider to create.
     * @returns An object containing the provider instance and its configuration.
     */
    abstract createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig };

    /**
     * Loads provider configurations from the environment.
     */
    abstract loadFromEnvironment(): void;

    /**
     * Gets a list of all available provider types that can be created.
     * @returns An array of provider type names.
     */
    abstract getAvailableProviders(): string[];

    /**
     * Gets a list of all providers that have been configured.
     * @returns An array of configured provider names.
     */
    abstract getConfiguredProviders(): string[];
}
