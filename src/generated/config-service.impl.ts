import { ConfigService } from '../services/config-service';
import type { AescConfig } from '../types';
import { DEFAULT_CONFIG, getConfig as getOriginalConfig, validateConfig as originalValidate } from '../config';

/**
 * Concrete implementation of the ConfigService.
 * It wraps the original config functions.
 */
export class ConfigServiceImpl extends ConfigService {
    getDefaultConfig(): AescConfig {
        return { ...DEFAULT_CONFIG };
    }

    getConfig(): AescConfig {
        return getOriginalConfig();
    }

    validateConfig(config: AescConfig): void {
        originalValidate(config);
    }
}
