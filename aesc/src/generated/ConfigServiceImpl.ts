import { ConfigService } from '../services/ConfigService';
import type { AescConfig } from '../services/types';

/**
 * Concrete implementation of the ConfigService.
 * This class provides application configuration.
 */
export class ConfigServiceImpl implements ConfigService {
    private readonly defaultConfig: AescConfig = {
        outputDir: 'src/generated',
        defaultModel: 'codellama',
        timeout: 600000, // 10 minutes
    };

    constructor() {}

    public getConfig(): AescConfig {
        return {
            ...this.defaultConfig,
            // Allow environment variables to override defaults
            defaultModel: process.env.AESC_DEFAULT_MODEL || this.defaultConfig.defaultModel,
            defaultProvider: process.env.AESC_DEFAULT_PROVIDER,
            timeout: process.env.AESC_TIMEOUT ? parseInt(process.env.AESC_TIMEOUT, 10) : this.defaultConfig.timeout,
        };
    }

    public validateConfig(config: AescConfig): void {
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
