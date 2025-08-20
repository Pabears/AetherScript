/**
 * @fileoverview Service for managing AI model providers.
 * This service handles the registration, configuration, and creation of
 * different AI model providers like Ollama, Cloudflare, etc.
 */

import { ProviderConfig, ModelProvider, ProviderOptions } from '../providers/base-provider';

/**
 * Abstract class defining the contract for a provider service.
 * Implementations will manage the lifecycle of AI model providers.
 * @service
 */
export abstract class ProviderService {
    /**
     * Registers a new provider type.
     * This allows for extending the service with new providers.
     * @param type The unique type identifier for the provider (e.g., 'ollama').
     * @param factory A function that returns a new instance of the ModelProvider.
     */
    abstract registerProvider(type: string, factory: () => ModelProvider): void;

    /**
     * Gets a list of all available (registered) provider types.
     * @returns An array of provider type strings.
     */
    abstract getAvailableProviders(): string[];

    /**
     * Adds or updates the configuration for a named provider instance.
     * @param name The name to assign to this configuration (e.g., 'my-ollama').
     * @param config The configuration object for the provider.
     */
    abstract setProviderConfig(name: string, config: ProviderConfig): void;

    /**
     * Retrieves the configuration for a named provider instance.
     * @param name The name of the provider configuration to retrieve.
     * @returns The provider configuration, or undefined if not found.
     */
    abstract getProviderConfig(name: string): ProviderConfig | undefined;

    /**
     * Retrieves all configured provider names.
     * @returns An array of configured provider names.
     */
    abstract getConfiguredProviders(): string[];

    /**
     * Sets the default provider to use when none is specified.
     * @param name The name of the provider configuration to set as default.
     */
    abstract setDefaultProvider(name: string): void;

    /**
     * Gets the name of the default provider.
     * @returns The name of the default provider.
     */
    abstract getDefaultProvider(): string;

    /**
     * Creates a provider instance.
     * If no name is provided, the default provider is used.
     * @param name The name of the configured provider to create.
     * @returns An object containing the provider instance and its configuration.
     */
    abstract createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig };

    /**
     * Loads provider configurations from environment variables.
     * For example, it can look for CLOUDFLARE_API_TOKEN or OLLAMA_ENDPOINT.
     */
    abstract loadFromEnvironment(): void;
}
