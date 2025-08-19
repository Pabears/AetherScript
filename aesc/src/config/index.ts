import * as fs from 'fs'
import * as path from 'path'
import type { AescConfig } from '../types'

// Default configuration
export const DEFAULT_CONFIG: AescConfig = {
  outputDir: 'src/generated',
  defaultModel: 'codellama',
  timeout: 600000, // 10 minutes
}

// Environment-based configuration
export function getConfig(): AescConfig {
  return {
    ...DEFAULT_CONFIG,
    // Allow environment variables to override defaults
    defaultModel: process.env.AESC_DEFAULT_MODEL ?? DEFAULT_CONFIG.defaultModel,
    defaultProvider: process.env.AESC_DEFAULT_PROVIDER,
    timeout: process.env.AESC_TIMEOUT
      ? parseInt(process.env.AESC_TIMEOUT)
      : DEFAULT_CONFIG.timeout,
  }
}

// Configuration validation
export function validateConfig(config: AescConfig): void {
  if (!config.outputDir) {
    throw new Error('Output directory is required')
  }
  if (!config.defaultModel) {
    throw new Error('Default model is required')
  }
  if (config.timeout && config.timeout < 1000) {
    throw new Error('Timeout must be at least 1000ms')
  }
}

export function initializeConfig(): void {
  const configPath = path.join(process.cwd(), 'aesc.config.json');
  if (fs.existsSync(configPath)) {
    console.log('aesc.config.json already exists.');
    return;
  }
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  console.log('aesc.config.json created successfully.');
}
