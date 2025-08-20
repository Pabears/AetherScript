import { ConfigService } from '../services/config-service';
import type { AescConfig } from '../types';
import { getConfig as originalGetConfig, validateConfig as originalValidateConfig } from '../config';

/**
 * @class ConfigServiceImpl
 * @description
 * Concrete implementation of the ConfigService.
 * It uses the original, unmodified functions from the `src/config` directory.
 */
export class ConfigServiceImpl extends ConfigService {
    /**
     * @override
     * @method getConfig
     * @description
     * Retrieves the application configuration by calling the original getConfig function.
     * @returns {AescConfig} The fully resolved application configuration.
     */
    getConfig(): AescConfig {
        return originalGetConfig();
    }

    /**
     * @override
     * @method validateConfig
     * @description
     * Validates a configuration object by calling the original validateConfig function.
     * @param {AescConfig} config - The configuration object to validate.
     */
    validateConfig(config: AescConfig): void {
        originalValidateConfig(config);
    }
}
