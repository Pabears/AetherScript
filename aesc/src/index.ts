#!/usr/bin/env bun
export * from './decorators';

import { main as cliMain } from './cli';
import type { GenerateOptions, GenerationResult } from './types';
import { container } from './generated/container';

// Re-export types for backward compatibility
export type { PropertyDependency, GeneratedService, GenerateOptions, OllamaResponse } from './types';

/**
 * @function handleGenerate
 * @description
 * Public API function to trigger the code generation process.
 * It configures and calls the GenerationService.
 */
export async function handleGenerate(force: boolean, files: string[], verbose: boolean, model: string, provider?: string): Promise<GenerationResult> {
    const options: GenerateOptions = {
        force,
        files,
        verbose,
        model,
        provider: provider || container.configService.getConfig().defaultProvider,
    };

    // The generate method now handles all logic, including statistics logging
    const result = await container.generationService.generate(options);

    return result;
}

// Run the CLI only if the script is executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    cliMain();
}
