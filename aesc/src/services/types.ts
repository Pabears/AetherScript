/**
 * Configuration for the aesc application.
 */
export interface AescConfig {
    outputDir: string;
    defaultModel: string;
    defaultProvider?: string;
    timeout?: number;
}

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

// Types for FileAnalysisService

export type PropertyDependency = {
    name: string;
    type: string;
};

export type GeneratedService = {
    interfaceName: string;
    implName: string;
    implFilePath: string;
    constructorDependencies: string[];
    propertyDependencies: PropertyDependency[];
};

/**
 * Represents a location in the source code.
 * Using 'any' to avoid direct dependency on 'ts-morph' in service interfaces.
 */
export type SourceCodeLocation = any;

/**
 * Represents a class declaration in the source code.
 * Using 'any' to avoid direct dependency on 'ts-morph' in service interfaces.
 */
export type ClassDeclaration = any;

/**
 * Represents an interface declaration in the source code.
 * Using 'any' to avoid direct dependency on 'ts-morph' in service interfaces.
 */
export type InterfaceDeclaration = any;


/**
 * Represents a ts-morph project.
 * Using 'any' to avoid direct dependency on 'ts-morph' in service interfaces.
 */
export type CodeProject = any;

// Types for CodeGenerationService

export interface ProcessGeneratedCodeParams {
    rawCode: string;
    declaration: any; // Represents a ts-morph Declaration
    implFilePath: string;
    originalImportPath: string;
    interfaceName: string;
    model: string;
    verbose?: boolean;
    provider?: string;
}

export interface ProcessGeneratedCodeResult {
    success: boolean;
    processedCode?: string;
    errors?: string[];
    attempts?: number;
}

// Types for DependencyAnalysisService

export interface DependencyInfo {
    dependenciesText: string;
    originalCode: string;
}

// Types for ServiceGenerationService

export interface GenerateOptions {
    force: boolean;
    files: string[];
    verbose: boolean;
    model: string;
    provider?: string;
}

export interface FileStats {
    interfaceName: string;
    status: 'generated' | 'skipped' | 'locked' | 'error';
    duration?: number;
    error?: string;
}
