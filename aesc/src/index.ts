#!/usr/bin/env bun
export * from './decorators';

import { main as cliMain } from './cli';
import type { GenerateOptions, GenerationResult } from './types';

// Service Imports
import { ConfigServiceImpl } from './generated/config.service.impl';
import { JSDocServiceImpl } from './generated/jsdoc.service.impl';
import { FileUtilsServiceImpl } from './generated/file-utils.service.impl';
import { LockManagerServiceImpl } from './generated/lock-manager.service.impl';
import { FileAnalysisServiceImpl } from './generated/file-analysis.service.impl';
import { LoggingServiceImpl } from './generated/logging.service.impl';
import { StatisticsServiceImpl } from './generated/statistics.service.impl';
import { ModelCallerServiceImpl } from './generated/model-caller.service.impl';
import { ProviderFactoryServiceImpl } from './generated/provider-factory.service.impl';
import { GenerationServiceImpl } from './generated/generation.service.impl';
import { DependencyAnalysisServiceImpl } from './generated/dependency-analysis.service.impl';

// Re-export types for backward compatibility
export type { PropertyDependency, GeneratedService, GenerateOptions, OllamaResponse } from './types';

// Instantiate services
const configService = new ConfigServiceImpl();
const loggingService = new LoggingServiceImpl();
const fileUtilsService = new FileUtilsServiceImpl();
const lockManagerService = new LockManagerServiceImpl();
const jsdocService = new JSDocServiceImpl();
const fileAnalysisService = new FileAnalysisServiceImpl();
const statisticsService = new StatisticsServiceImpl();
const providerFactoryService = new ProviderFactoryServiceImpl();
const modelCallerService = new ModelCallerServiceImpl(providerFactoryService);
const dependencyAnalysisService = new DependencyAnalysisServiceImpl(jsdocService);

// Instantiate the main generation service with all its dependencies
const generationService = new GenerationServiceImpl(
    configService,
    jsdocService,
    fileUtilsService,
    lockManagerService,
    fileAnalysisService,
    loggingService,
    statisticsService,
    modelCallerService,
    dependencyAnalysisService
);

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
        provider: provider || configService.getConfig().defaultProvider,
    };

    // The generate method now handles all logic, including statistics logging
    const result = await generationService.generate(options);

    return result;
}

// Run the CLI only if the script is executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    cliMain();
}
