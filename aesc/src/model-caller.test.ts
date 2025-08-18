import { describe, it, expect, mock, spyOn, afterEach, beforeEach } from 'bun:test';
import {
  callOllamaModel,
  configureProvider,
  setDefaultProvider,
  listProviders,
} from './model-caller';
import { Provider, ProviderFactory, ProviderManager } from './providers';

// Mock the concrete providers that ProviderFactory might create
const mockProvider: Provider = {
  name: 'mock-provider',
  generate: mock(async (prompt, model, options) => 'generated code'),
};

describe('model-caller', () => {
  let manager: ProviderManager;
  const spies: { mockRestore: () => void }[] = [];

  beforeEach(() => {
    manager = new ProviderManager();
    // Spy on the factory methods and track the spies
    spies.push(spyOn(ProviderFactory, 'createProvider').mockReturnValue(mockProvider));
    spies.push(spyOn(ProviderFactory, 'getAvailableProviders').mockReturnValue(['mock-provider-type']));
    // Reset the generate mock itself
    mockProvider.generate.mockClear();
  });

  afterEach(() => {
    // Restore all spies
    spies.forEach(s => s.mockRestore());
    spies.length = 0;
  });

  describe('callOllamaModel', () => {
    it('should use the provided manager to create a provider', async () => {
      configureProvider('test', 'mock-type', {}, 'test-model', manager);
      await callOllamaModel('prompt', 'ITest', 'my-model', false, 'test', {}, manager);

      expect(ProviderFactory.createProvider).toHaveBeenCalledWith('mock-type');
      expect(mockProvider.generate).toHaveBeenCalledWith('prompt', 'my-model', expect.any(Object));
    });
  });

  describe('configureProvider', () => {
    it('should configure the provided manager', () => {
      configureProvider('my-provider', 'my-type', { setting: 1 }, 'my-model', manager);
      const config = manager.getProviderConfig('my-provider');
      expect(config).toEqual({
        type: 'my-type',
        defaultModel: 'my-model',
        settings: { setting: 1 },
      });
    });
  });

  describe('setDefaultProvider', () => {
    it('should set the default on the provided manager', () => {
      configureProvider('my-provider', 'my-type', {}, undefined, manager);
      setDefaultProvider('my-provider', manager);
      expect(manager.defaultProvider).toBe('my-provider');
    });
  });

  describe('listProviders', () => {
    it('should list providers from the provided manager', () => {
      configureProvider('p1', 't1', {}, undefined, manager);
      configureProvider('p2', 't2', {}, undefined, manager);
      const result = listProviders(manager);
      expect(result.configured).toEqual(expect.arrayContaining(['ollama', 'p1', 'p2']));
      expect(ProviderFactory.getAvailableProviders).toHaveBeenCalled();
    });
  });
});
