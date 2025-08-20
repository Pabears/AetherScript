import { ConfigService } from '../services/config-service';
import type { AescConfig } from '../types';

/**
 * @class ConfigServiceImpl
 * @description
 * Concrete implementation of the ConfigService.
 * This class contains the actual logic for managing configuration.
 */
export class ConfigServiceImpl extends ConfigService {

    /**
     * @override
     */
    getConfig(): AescConfig {
        return {
            ...ConfigServiceImpl.DEFAULT_CONFIG,
            // Allow environment variables to override defaults
            defaultModel: process.env.AESC_DEFAULT_MODEL || ConfigServiceImpl.DEFAULT_CONFIG.defaultModel,
            defaultProvider: process.env.AESC_DEFAULT_PROVIDER,
            timeout: process.env.AESC_TIMEOUT ? parseInt(process.env.AESC_TIMEOUT) : ConfigServiceImpl.DEFAULT_CONFIG.timeout,
        };
    }

    /**
     * @override
     */
    validateConfig(config: AescConfig): void {
        if (!config.outputDir) {
            throw new Error('Output directory is required');
        }
        if (!config.defaultModel) {
            throw new Error('Default model is required');
        }
        if (config.timeout && config.timeout < 1000) {
            throw new Error('Timeout must be at least 1000ms');
        }
    }
}