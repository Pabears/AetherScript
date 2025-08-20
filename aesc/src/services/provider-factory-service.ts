import type { ModelProvider, ProviderConfig } from '../providers/base-provider';

/**
 * @abstract
 * @class ProviderFactoryService
 * @description
 * Service responsible for creating and managing language model provider instances.
 * It handles provider registration, configuration management, and instantiation.
 */
export abstract class ProviderFactoryService {
    /**
     * @abstract
     * @method createProvider
     * @description
     * Creates a provider instance based on a configuration name.
     * If no name is provided, it uses the default provider configuration.
     * @param {string} [name] - The optional name of the provider configuration to use.
     * @returns {{ provider: ModelProvider; config: ProviderConfig }} An object containing the provider instance and its configuration.
     */
    abstract createProvider(name?: string): { provider: ModelProvider; config: ProviderConfig };

    /**
     * @abstract
     * @method setProviderConfig
     * @description
     * Sets or updates a provider's configuration.
     * @param {string} name - The name for the configuration (e.g., 'my-ollama').
     * @param {ProviderConfig} config - The provider configuration object.
     * @returns {void}
     */
    abstract setProviderConfig(name: string, config: ProviderConfig): void;

    /**
     * @abstract
     * @method getProviderConfig
     * @description
     * Retrieves a provider's configuration by its name.
     * @param {string} name - The name of the configuration.
     * @returns {ProviderConfig | undefined} The configuration object or undefined if not found.
     */
    abstract getProviderConfig(name: string): ProviderConfig | undefined;

    /**
     * @abstract
     * @method setDefaultProvider
     * @description
     * Sets the default provider configuration to use for subsequent operations.
     * @param {string} name - The name of the provider configuration.
     * @returns {void}
     */
    abstract setDefaultProvider(name: string): void;

    /**
     * @abstract
     * @method getConfiguredProviders
     * @description
     * Returns a list of all named provider configurations.
     * @returns {string[]} An array of configuration names.
     */
    abstract getConfiguredProviders(): string[];

    /**
     * @abstract
     * @method getAvailableProviders
     * @description
     * Returns a list of all available (registered) provider types (e.g., 'ollama', 'cloudflare').
     * @returns {string[]} An array of available provider type names.
     */
    abstract getAvailableProviders(): string[];
}
