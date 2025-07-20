/**
 * Base interface for AI model providers
 * Abstracts away provider-specific implementation details
 */
export interface ModelProvider {
    /**
     * Provider name (e.g., 'ollama', 'cloudflare', 'openai')
     */
    readonly name: string;

    /**
     * Generate code using the provider's AI model
     * @param prompt The prompt to send to the model
     * @param model The model name/identifier
     * @param options Provider-specific options
     * @returns Generated response text
     */
    generate(prompt: string, model: string, options?: ProviderOptions): Promise<string>;

    /**
     * Validate if the provider is properly configured and available
     * @returns Promise that resolves if provider is ready, rejects otherwise
     */
    validateConnection(): Promise<void>;

    /**
     * Get list of available models for this provider
     * @returns Array of model identifiers
     */
    getAvailableModels?(): Promise<string[]>;
}

/**
 * Common options that can be passed to providers
 */
export interface ProviderOptions {
    /**
     * Custom endpoint URL (overrides default)
     */
    endpoint?: string;

    /**
     * Authentication headers or tokens
     */
    auth?: {
        [key: string]: string;
    };

    /**
     * Additional HTTP headers
     */
    headers?: {
        [key: string]: string;
    };

    /**
     * Request timeout in milliseconds
     */
    timeout?: number;

    /**
     * Enable verbose logging
     */
    verbose?: boolean;

    /**
     * Provider-specific configuration
     */
    [key: string]: any;
}

/**
 * Provider configuration stored in config files
 */
export interface ProviderConfig {
    /**
     * Provider type
     */
    type: string;

    /**
     * Default model to use
     */
    defaultModel?: string;

    /**
     * Provider-specific settings
     */
    settings: {
        endpoint?: string;
        auth?: {
            [key: string]: string;
        };
        [key: string]: any;
    };
}
