#!/usr/bin/env bun

import { main as cliMain } from './cli';

// Re-export decorators for external usage
export * from './decorators';

// Re-export some core types for backward compatibility or library usage
export type {
    GenerateOptions,
    GeneratedService,
    PropertyDependency
} from './services/types';


// Run the CLI only if the script is executed directly from the command line.
// This allows the file to be imported as a module without running the CLI.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    cliMain();
}
