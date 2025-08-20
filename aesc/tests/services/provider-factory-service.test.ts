import { describe, test, expect, beforeEach } from 'bun:test';
import { ProviderFactoryServiceImpl } from '../../src/generated/provider-factory.service.impl';
import { OllamaProvider } from '../../src/providers/ollama-provider';
import type { ProviderConfig } from '../../src/providers/base-provider';

describe('ProviderFactoryService', () => {
    let service: ProviderFactoryServiceImpl;

    beforeEach(() => {
        service = new ProviderFactoryServiceImpl();
    });

    test('getAvailableProviders should return known provider types', () => {
        const available = service.getAvailableProviders();
        expect(available).toBeInstanceOf(Array);
        expect(available).toContain('ollama');
        expect(available).toContain('cloudflare');
    });

    test('getConfiguredProviders should return default configured providers', () => {
        const configured = service.getConfiguredProviders();
        // Based on previous test findings, we expect 'ollama' to be a default configured provider.
        expect(configured).toContain('ollama');
    });

    test('createProvider should create a provider instance', () => {
        const result = service.createProvider('ollama');
        expect(result).toBeDefined();
        expect(result.provider).toBeInstanceOf(OllamaProvider);
        expect(result.config.type).toBe('ollama');
    });

    test('createProvider should throw for an unknown provider type', () => {
        // This test requires setting a config for a non-existent provider type first
        const badConfig: ProviderConfig = {
            type: 'non-existent-provider',
            settings: {}
        };
        service.setProviderConfig('bad', badConfig);
        expect(() => service.createProvider('bad')).toThrow('Unknown provider type: non-existent-provider');
    });

    test('setProviderConfig and getProviderConfig should manage custom configurations', () => {
        const customConfig: ProviderConfig = {
            type: 'cloudflare',
            defaultModel: 'my-custom-model',
            settings: {
                endpoint: 'https://example.com',
                auth: { 'X-Api-Key': '12345' }
            }
        };

        // Set the custom config
        service.setProviderConfig('my-custom-cf', customConfig);

        // Get it back
        const retrievedConfig = service.getProviderConfig('my-custom-cf');

        expect(retrievedConfig).toBeDefined();
        expect(retrievedConfig).toEqual(customConfig);
        expect(service.getConfiguredProviders()).toContain('my-custom-cf');
    });
});
