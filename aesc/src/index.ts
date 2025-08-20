#!/usr/bin/env bun

/**
 * @fileoverview Main entry point for the aesc library and CLI.
 * This file exports the main container, services, types, and runs the CLI.
 */

import { container } from './generated/container';

// --- Main Application Container ---
export { container };
export type { AppContainer } from './generated/container';

// --- Service Interfaces and Types ---
export { LoggingService, LogLevel } from './services/logging-service';
export type { LogEntry } from './services/logging-service';
export type { ConfigService } from './services/config-service';
export type { FileAnalysisService, ServiceAnalysisResult } from './services/file-analysis-service';
export type { GenerationService, FileStats, GenerationResult } from './services/generation-service';
export type { JsdocService } from './services/jsdoc-service';
export type { LockingService } from './services/locking-service';
export type { ProviderService } from './services/provider-service';

// --- Core Types ---
export type { AescConfig, GenerateOptions } from './types';
// These types are still in their original locations, so we re-export from there
export type { PropertyDependency } from './file-analysis';
export type { JSDocInfo } from './jsdoc/extractor';
export type { ProviderConfig, ModelProvider, ProviderOptions } from './providers/base-provider';
export type { GeneratedService } from './core/generator';


// --- Decorators ---
export * from './decorators';


// --- CLI Execution ---
if (process.argv[1] && (import.meta.url.endsWith(process.argv[1]) || import.meta.url.endsWith(process.argv[1].replace(process.cwd(),'').substring(1)))) {
    container.cli.run(process.argv).catch(error => {
        container.logging.error('Unhandled CLI error', 'CLI', { error });
        process.exit(1);
    });
}
