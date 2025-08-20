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
}
