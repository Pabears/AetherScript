import { describe, test, expect, beforeEach } from 'bun:test';
import { ConfigServiceImpl } from '../../src/generated/config.service.impl';
import { ConfigService } from '../../src/services/config-service';
import type { AescConfig } from '../../src/types';

describe('ConfigService', () => {
    let configService: ConfigServiceImpl;

    beforeEach(() => {
        configService = new ConfigServiceImpl();
    });

    test('getConfig should return default configuration', () => {
        const config = configService.getConfig();
        const defaultConfig = ConfigService.DEFAULT_CONFIG;

        expect(config.outputDir).toBe(defaultConfig.outputDir);
        expect(config.defaultModel).toBe(defaultConfig.defaultModel);
        expect(config.timeout).toBe(defaultConfig.timeout);
    });

    test('validateConfig should not throw for a valid config', () => {
        const validConfig: AescConfig = {
            outputDir: 'dist',
            defaultModel: 'test-model',
            timeout: 5000,
        };
        // Expecting no error to be thrown
        expect(() => configService.validateConfig(validConfig)).not.toThrow();
    });

    test('validateConfig should throw if outputDir is missing', () => {
        const invalidConfig = {
            defaultModel: 'test-model',
        } as AescConfig;
        expect(() => configService.validateConfig(invalidConfig)).toThrow('Output directory is required');
    });

    test('validateConfig should throw if defaultModel is missing', () => {
        const invalidConfig = {
            outputDir: 'dist',
        } as AescConfig;
        expect(() => configService.validateConfig(invalidConfig)).toThrow('Default model is required');
    });

    test('validateConfig should throw if timeout is too short', () => {
        const invalidConfig: AescConfig = {
            outputDir: 'dist',
            defaultModel: 'test-model',
            timeout: 500, // less than 1000
        };
        expect(() => configService.validateConfig(invalidConfig)).toThrow('Timeout must be at least 1000ms');
    });
});
