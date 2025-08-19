#!/usr/bin/env bun
export * from './decorators';

// Import workflow modules (still needed for CLI commands)
import { indexJSDocCommand, clearJSDocIndexCommand } from './commands/index-jsdoc';
import { listProvidersCommand, testProviderCommand, showProviderExamplesCommand, testGenerationCommand } from './commands/provider-commands';
import { handleLockUnlock } from './core/lock-manager';

// Import new modular components
import { printGenerationStatistics } from './core/statistics';
import { generateCode } from './core/generator';
import { getAllExistingServices } from './core/service-generator';
import { getConfig } from './config';
import type { GenerateOptions } from './types';

// Import modular CLI
import { main as cliMain } from './cli';

// Configuration
const config = getConfig();

// Re-export types for backward compatibility
export type { PropertyDependency, GeneratedService } from './file-analysis';
export type { GenerateOptions } from './types';
export type { OllamaResponse } from './model-caller';

export async function handleGenerate(force: boolean, files: string[], verbose: boolean, model: string, provider?: string) {
    // Use modular generator with options
    const options: GenerateOptions = {
        force,
        files,
        verbose,
        model,
        provider
    };
    
    const result = await generateCode(options);
    
    // Print statistics using modular statistics module
    printGenerationStatistics(result, verbose);
    
    return result;
}

// Run the CLI only if the script is executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    cliMain();
}
