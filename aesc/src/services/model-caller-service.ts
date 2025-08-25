import { ProviderManager, type ProviderOptions } from '../providers';

export interface OllamaResponse {
    response: string;
}

/**
 * @abstract
 * @class ModelCallerService
 * @description
 * Service responsible for interacting with language model providers.
 * It handles calling the models with the correct prompts and managing provider configurations.
 */
export abstract class ModelCallerService {
    /**
     * @abstract
     * @method callOllamaModel
     * @description
     * Calls the appropriate AI model with a given prompt to generate code.
     * It selects the provider and model based on configuration and options.
     * @param {string} prompt - The prompt to send to the model.
     * @param {string} interfaceName - A string (like an interface name) for logging purposes.
     * @param {string} model - The specific model name to use.
     * @param {boolean} verbose - Flag to enable verbose logging.
     * @param {string} [providerName] - Optional name of the provider to use.
     * @param {ProviderOptions} [providerOptions] - Optional provider-specific settings.
     * @returns {Promise<string>} The raw text response from the language model.
     */
    abstract callOllamaModel(
        prompt: string,
        interfaceName: string,
        model: string,
        verbose: boolean,
        providerName?: string,
        providerOptions?: ProviderOptions
    ): Promise<string>;

    /**
     * @deprecated Use callOllamaModel instead
     */
    abstract callModel(
        prompt: string,
        interfaceName: string,
        model: string,
        verbose: boolean,
        providerName?: string,
        providerOptions?: ProviderOptions
    ): Promise<string>;

    /**
     * @abstract
     * @method getProviderManager
     * @description
     * Get the global provider manager instance
     * Useful for configuration and provider management
     */
    abstract getProviderManager(): ProviderManager;

    /**
     * @abstract
     * @method configureProvider
     * @description
     * Adds or updates a provider's configuration.
     * @param {string} name - A name for the provider configuration (e.g., 'my-ollama').
     * @param {string} type - The type of the provider (e.g., 'ollama', 'cloudflare').
     * @param {Record<string, any>} settings - Provider-specific settings (e.g., endpoint, auth key).
     * @param {string} [defaultModel] - The default model to use for this provider configuration.
     * @returns {void}
     */
    abstract configureProvider(
        name: string,
        type: string,
        settings: Record<string, any>,
        defaultModel?: string
    ): void;

    /**
     * @abstract
     * @method setDefaultProvider
     * @description
     * Sets the default provider configuration to use for subsequent model calls.
     * @param {string} providerName - The name of the provider configuration to set as default.
     * @returns {void}
     */
    abstract setDefaultProvider(providerName: string): void;

    /**
     * @abstract
     * @method listProviders
     * @description
     * Lists all available provider types and all named provider configurations.
     * @returns {{ available: string[]; configured: string[] }} An object containing available and configured providers.
     */
    abstract listProviders(): { available: string[]; configured: string[] };
}
