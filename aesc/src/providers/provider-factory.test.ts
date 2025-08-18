import { describe, it, expect, beforeEach, spyOn } from 'bun:test'
import { ProviderFactory, ProviderManager } from './provider-factory'
import { OllamaProvider } from './ollama-provider'
import { CloudflareProvider } from './cloudflare-provider'

describe('ProviderFactory', () => {
  it('should create an OllamaProvider', () => {
    const provider = ProviderFactory.createProvider('ollama')
    expect(provider).toBeInstanceOf(OllamaProvider)
  })

  it('should create a CloudflareProvider', () => {
    const provider = ProviderFactory.createProvider('cloudflare')
    expect(provider).toBeInstanceOf(CloudflareProvider)
  })

  it('should throw for an unknown provider', () => {
    expect(() => ProviderFactory.createProvider('unknown')).toThrow()
  })

  it('should register and create a custom provider', () => {
    class CustomProvider {}
    ProviderFactory.registerProvider('custom', () => new CustomProvider() as any)
    const provider = ProviderFactory.createProvider('custom')
    expect(provider).toBeInstanceOf(CustomProvider)
  })

  it('should get available providers', () => {
    const providers = ProviderFactory.getAvailableProviders()
    expect(providers).toEqual(expect.arrayContaining(['ollama', 'cloudflare', 'custom']))
  })
})

describe('ProviderManager', () => {
  let manager: ProviderManager

  beforeEach(() => {
    manager = new ProviderManager()
    // Clean up env variables
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.OLLAMA_ENDPOINT
  })

  it('should have default ollama config', () => {
    const config = manager.getProviderConfig('ollama')
    expect(config).toBeDefined()
    expect(config!.type).toBe('ollama')
  })

  it('should set and get provider config', () => {
    const newConfig = { type: 'test', settings: {} }
    manager.setProviderConfig('test', newConfig)
    expect(manager.getProviderConfig('test')).toEqual(newConfig)
  })

  it('should set and get default provider', () => {
    manager.setProviderConfig('test', { type: 'test', settings: {} })
    manager.setDefaultProvider('test')
    expect(manager.getDefaultProvider()).toBe('test')
  })

  it('should throw when setting a non-configured default provider', () => {
    expect(() => manager.setDefaultProvider('non-existent')).toThrow()
  })

  it('should create a provider instance', () => {
    const { provider, config } = manager.createProvider('ollama')
    expect(provider).toBeInstanceOf(OllamaProvider)
    expect(config.type).toBe('ollama')
  })

  it('should throw when creating a non-configured provider', () => {
    expect(() => manager.createProvider('non-existent')).toThrow()
  })

  it('should load cloudflare config from environment', () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-id'
    process.env.CLOUDFLARE_API_TOKEN = 'test-token'
    manager.loadFromEnvironment()
    const config = manager.getProviderConfig('cloudflare')
    expect(config).toBeDefined()
    expect(config!.type).toBe('cloudflare')
  })

  it('should load ollama endpoint from environment', () => {
    process.env.OLLAMA_ENDPOINT = 'http://custom-ollama'
    manager.loadFromEnvironment()
    const config = manager.getProviderConfig('ollama')
    expect(config!.settings.endpoint).toBe('http://custom-ollama')
  })

  it('should get configured providers', () => {
    manager.setProviderConfig('test', { type: 'test', settings: {} })
    const providers = manager.getConfiguredProviders()
    expect(providers).toEqual(['ollama', 'test'])
  })
})
