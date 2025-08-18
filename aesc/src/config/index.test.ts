import { describe, it, expect, beforeEach } from 'bun:test'
import { DEFAULT_CONFIG, getConfig, validateConfig } from './index'

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv }
  })

  describe('getConfig', () => {
    it('should return default config when no env vars are set', () => {
      const config = getConfig()
      expect(config.defaultModel).toBe(DEFAULT_CONFIG.defaultModel)
      expect(config.timeout).toBe(DEFAULT_CONFIG.timeout)
    })

    it('should override defaults with env vars', () => {
      process.env.AESC_DEFAULT_MODEL = 'test-model'
      process.env.AESC_DEFAULT_PROVIDER = 'test-provider'
      process.env.AESC_TIMEOUT = '12345'

      const config = getConfig()

      expect(config.defaultModel).toBe('test-model')
      expect(config.defaultProvider).toBe('test-provider')
      expect(config.timeout).toBe(12345)
    })
  })

  describe('validateConfig', () => {
    it('should not throw for a valid config', () => {
      expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow()
    })

    it('should throw if outputDir is missing', () => {
      const invalidConfig = { ...DEFAULT_CONFIG, outputDir: '' }
      expect(() => validateConfig(invalidConfig)).toThrow('Output directory is required')
    })

    it('should throw if defaultModel is missing', () => {
      const invalidConfig = { ...DEFAULT_CONFIG, defaultModel: '' }
      expect(() => validateConfig(invalidConfig)).toThrow('Default model is required')
    })

    it('should throw if timeout is too low', () => {
      const invalidConfig = { ...DEFAULT_CONFIG, timeout: 500 }
      expect(() => validateConfig(invalidConfig)).toThrow('Timeout must be at least 1000ms')
    })
  })
})
