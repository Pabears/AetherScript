import { describe, it, expect } from 'bun:test'
import { DEFAULT_CONFIG, validateConfig } from '../../src/config'

describe('config', () => {
  describe('validateConfig', () => {
    it('should not throw for a valid config', () => {
      expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
    });

    it('should throw if outputDir is missing', () => {
      const invalidConfig = { ...DEFAULT_CONFIG, outputDir: '' };
      expect(() => validateConfig(invalidConfig)).toThrow('Output directory is required');
    });

    it('should throw if defaultModel is missing', () => {
      const invalidConfig = { ...DEFAULT_CONFIG, defaultModel: '' };
      expect(() => validateConfig(invalidConfig)).toThrow('Default model is required');
    });

    it('should throw if timeout is too low', () => {
      const invalidConfig = { ...DEFAULT_CONFIG, timeout: 500 };
      expect(() => validateConfig(invalidConfig)).toThrow('Timeout must be at least 1000ms');
    });
  });
});
