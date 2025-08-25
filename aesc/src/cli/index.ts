#!/usr/bin/env bun

import { parseArgs, argsToGenerateOptions } from './args-parser';
import { container } from '../generated/container';


/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
    try {
        const args = parseArgs();
        const command = args._[0];

        switch (command) {
            case 'gen':
                const options = argsToGenerateOptions(args);
                await container.commandService.runGenerate(options);
                break;

            case 'test-generation':
                await container.commandService.runTestGeneration(args.provider, args.model);
                break;

            case 'list-providers':
                await container.commandService.runListProviders();
                break;

            case 'test-provider':
                await container.commandService.runTestProvider(args.provider);
                break;

            case 'show-provider-examples':
                await container.commandService.runShowProviderExamples();
                break;

            case 'index-jsdoc':
                await container.commandService.runJSDocIndex();
                break;

            

            case 'lock':
                container.lockManagerService.lock(args.files);
                break;

            case 'unlock':
                container.lockManagerService.unlock(args.files);
                break;

            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (error) {
        console.error('CLI Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

// Run the CLI only if the script is executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    main();
}
