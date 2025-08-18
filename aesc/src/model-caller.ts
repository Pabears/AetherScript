import { InterfaceDeclaration, ClassDeclaration } from 'ts-morph'
import {
  ProviderManager,
  ProviderFactory,
  type ProviderOptions,
} from './providers'

export interface OllamaResponse {
  response: string
}

let defaultManager: ProviderManager | undefined;

function getDefaultProviderManager(): ProviderManager {
    if (!defaultManager) {
        defaultManager = new ProviderManager();
        defaultManager.loadFromEnvironment();
    }
    return defaultManager;
}

/**
 * Call AI model using the configured provider system
 * @param prompt The prompt to send to the model
 * @param interfaceName Interface name for logging purposes
 * @param model The model name to use
 * @param verbose Enable verbose logging
 * @param providerName Optional provider name (defaults to configured default)
 * @param providerOptions Optional provider-specific options
 * @param manager Optional ProviderManager instance
 * @returns Generated response text
 */
export async function callOllamaModel(
  prompt: string,
  interfaceName: string,
  model: string,
  verbose: boolean,
  providerName?: string,
  providerOptions?: ProviderOptions,
  manager?: ProviderManager,
): Promise<string> {
  const providerManager = manager || getDefaultProviderManager();
  try {
    const { provider, config } = providerManager.createProvider(providerName)

    // Merge configuration with provided options
    const options: ProviderOptions = {
      verbose,
      endpoint: config.settings.endpoint,
      auth: config.settings.auth,
      ...config.settings,
      ...providerOptions,
    }

    // Use the configured default model if no specific model is provided
    const modelToUse = model || config.defaultModel || 'codellama'

    console.log(
      `  -> Using provider: ${provider.name} with model: ${modelToUse}`,
    )

    return await provider.generate(prompt, modelToUse, options)
  } catch (error) {
    console.error(
      `Failed to generate code using provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    throw error
  }
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use callOllamaModel instead
 */
export const callModel = callOllamaModel

/**
 * Get the global provider manager instance
 * Useful for configuration and provider management
 */
export function getProviderManager(): ProviderManager {
  return getDefaultProviderManager();
}

/**
 * Configure a new provider
 * @param name Provider configuration name
 * @param type Provider type (ollama, cloudflare, etc.)
 * @param settings Provider-specific settings
 * @param defaultModel Default model for this provider
 * @param manager Optional ProviderManager instance
 */
export function configureProvider(
  name: string,
  type: string,
  settings: Record<string, unknown>,
  defaultModel?: string,
  manager?: ProviderManager,
): void {
  const providerManager = manager || getDefaultProviderManager();
  providerManager.setProviderConfig(name, {
    type,
    defaultModel,
    settings,
  })
}

/**
 * Set the default provider to use
 * @param providerName Name of the configured provider
 * @param manager Optional ProviderManager instance
 */
export function setDefaultProvider(providerName: string, manager?: ProviderManager): void {
  const providerManager = manager || getDefaultProviderManager();
  providerManager.setDefaultProvider(providerName)
}

/**
 * List all available and configured providers
 * @param manager Optional ProviderManager instance
 */
export function listProviders(manager?: ProviderManager): { available: string[]; configured: string[] } {
  const providerManager = manager || getDefaultProviderManager();
  return {
    available: ProviderFactory.getAvailableProviders(),
    configured: providerManager.getConfiguredProviders(),
  }
}
