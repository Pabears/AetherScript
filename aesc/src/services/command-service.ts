import type { GenerateOptions } from '../types';

/**
 * @abstract
 * @class CommandService
 * @description
 * Service responsible for executing the main application commands.
 * This acts as the entry point for business logic triggered by the CLI.
 */
export abstract class CommandService {
    /**
     * @abstract
     * @method runGenerate
     * @description
     * Executes the core code generation process based on provided options.
     * @param {GenerateOptions} options - The options for the generation command.
     * @returns {Promise<void>}
     */
    abstract runGenerate(options: GenerateOptions): Promise<void>;

    /**
     * @abstract
     * @method runJSDocIndex
     * @description
     * Scans `package.json` and indexes the JSDoc for all dependencies.
     * @returns {Promise<void>}
     */
    abstract runJSDocIndex(): Promise<void>;

    /**
     * @abstract
     * @method runListProviders
     * @description
     * Lists all available and configured model providers.
     * @returns {Promise<void>}
     */
    abstract runListProviders(): Promise<void>;

    /**
     * @abstract
     * @method runTestProvider
     * @description
     * Tests the connection to a specific provider.
     * @param {string} [providerName] - The name of the provider to test.
     * @returns {Promise<void>}
     */
    abstract runTestProvider(providerName?: string): Promise<void>;

    /**
     * @abstract
     * @method runShowProviderExamples
     * @description
     * Shows examples of how to configure and use providers.
     * @returns {Promise<void>}
     */
    abstract runShowProviderExamples(): Promise<void>;

    /**
     * @abstract
     * @method runTestGeneration
     * @description
     * Runs a test generation with a specific provider and model.
     * @param {string} [providerName] - The name of the provider to use.
     * @param {string} [model] - The name of the model to use.
     * @returns {Promise<void>}
     */
    abstract runTestGeneration(providerName?: string, model?: string): Promise<void>;
}
