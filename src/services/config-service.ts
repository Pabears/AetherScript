/**
 * @fileoverview Service for managing application configuration.
 * This service provides a centralized way to access and validate configuration,
 * which can be sourced from defaults, environment variables, or a configuration file.
 */

import type { AescConfig } from '../types';

/**
 * Abstract class defining the contract for a configuration service.
 * Implementations will handle loading and merging configuration from various sources.
 * @service
 */
export abstract class ConfigService {
    /**
     * Retrieves the default application configuration.
     * This should return a hardcoded configuration object.
     * @returns The default configuration object.
     */
    abstract getDefaultConfig(): AescConfig;

    /**
     * Retrieves the current application configuration.
     * This method should merge the default configuration with any overrides
     * from environment variables or a configuration file.
     * @returns The resolved application configuration.
     */
    abstract getConfig(): AescConfig;

    /**
     * Validates a given configuration object.
     * This method should throw an error if the configuration is invalid.
     * For example, it can check for required fields or valid value ranges.
     * @param config The configuration object to validate.
     */
    abstract validateConfig(config: AescConfig): void;
}
