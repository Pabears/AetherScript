import type { AescConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants/config';

/**
 * @abstract
 * @class ConfigService
 * @description
 * Service responsible for managing the application's configuration.
 * It provides the default configuration, merges it with environment variables,
 * and validates the final configuration.
 */
export abstract class ConfigService {
    /**
     * @description
     * The default configuration for the application.
     */
    static readonly DEFAULT_CONFIG: AescConfig = DEFAULT_CONFIG;

    /**
     * @abstract
     * @method getConfig
     * @description
     * Retrieves the application configuration, merging default values with
     * any overrides from environment variables.
     * @returns {AescConfig} The fully resolved application configuration.
     */
    abstract getConfig(): AescConfig;

    /**
     * @abstract
     * @method validateConfig
     * @description
     * Validates a given configuration object to ensure it meets the application's requirements.
     * Throws an error if the configuration is invalid.
     * @param {AescConfig} config - The configuration object to validate.
     * @throws {Error} If the configuration is invalid.
     */
    abstract validateConfig(config: AescConfig): void;
}
