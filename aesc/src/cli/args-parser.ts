import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { GenerateOptions } from '../types';
import { container } from '../generated/container';

/**
 * Parse command line arguments and return structured options
 */
export function parseArgs(): any {
    const config = container.configService.getConfig();
    
    return yargs(hideBin(process.argv))
        .command('gen', 'Generate service implementations', (yargs) => {
            return yargs
                .option('force', {
                    alias: 'f',
                    type: 'boolean',
                    description: 'Force overwrite existing files',
                    default: false,
                })
                .option('files', {
                    type: 'array',
                    description: 'Specific files to process',
                    default: [],
                })
                .option('verbose', {
                    alias: 'v',
                    type: 'boolean',
                    description: 'Enable verbose output',
                    default: false,
                })
                .option('model', {
                    alias: 'm',
                    type: 'string',
                    description: 'AI model to use',
                    default: config.defaultModel,
                })
                .option('provider', {
                    alias: 'p',
                    type: 'string',
                    description: 'AI provider to use (ollama, cloudflare)',
                    default: config.defaultProvider,
                });
        })
        .command('test-generation', 'Test code generation with timing statistics', (yargs) => {
            return yargs
                .option('provider', {
                    alias: 'p',
                    type: 'string',
                    description: 'AI provider to use',
                })
                .option('model', {
                    alias: 'm',
                    type: 'string',
                    description: 'AI model to use',
                });
        })
        .command('list-providers', 'List available AI providers')
        .command('test-provider', 'Test AI provider connection', (yargs) => {
            return yargs
                .option('provider', {
                    alias: 'p',
                    type: 'string',
                    description: 'Provider to test',
                    demandOption: true,
                })
                .option('model', {
                    alias: 'm',
                    type: 'string',
                    description: 'Model to test',
                });
        })
        .command('show-provider-examples', 'Show provider configuration examples')
        .command('index-jsdoc', 'Index JSDoc documentation from dependencies')
        .command('clear-jsdoc', 'Clear JSDoc documentation cache')
        .command('lock', 'Lock generated files to prevent overwriting', (yargs) => {
            return yargs
                .option('files', {
                    type: 'array',
                    description: 'Files to lock',
                    demandOption: true,
                });
        })
        .command('unlock', 'Unlock generated files', (yargs) => {
            return yargs
                .option('files', {
                    type: 'array',
                    description: 'Files to unlock',
                    demandOption: true,
                });
        })
        .demandCommand(1, 'You need at least one command before moving on')
        .help()
        .alias('help', 'h')
        .parseSync();
}

/**
 * Convert parsed args to GenerateOptions
 */
export function argsToGenerateOptions(args: any): GenerateOptions {
    return {
        force: args.force || false,
        files: args.files || [],
        verbose: args.verbose || false,
        model: args.model,
        provider: args.provider,
    };
}
