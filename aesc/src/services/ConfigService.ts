import type { AescConfig } from './types';

/**
 * Abstract class for a configuration service.
 * This service is responsible for providing application configuration.
 */
export abstract class ConfigService {
    /**
     * Retrieves the application configuration.
     * @returns The AescConfig object.
     */
    abstract getConfig(): AescConfig;

    /**
     * Validates a given configuration object.
     * Throws an error if the configuration is invalid.
     * @param config The configuration object to validate.
     */
    abstract validateConfig(config: AescConfig): void;
}
