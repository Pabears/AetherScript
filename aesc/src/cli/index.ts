#!/usr/bin/env bun

import { parseArgs, argsToGenerateOptions } from './args-parser'
import { handleGenerate } from './commands/generate'
import { handleLockUnlock } from '../file-saver'

// Import existing command handlers
import {
  indexJSDocCommand,
  clearJSDocIndexCommand,
} from '../commands/index-jsdoc'
import {
  listProvidersCommand,
  testProviderCommand,
  showProviderExamplesCommand,
  testGenerationCommand,
} from '../commands/provider-commands'

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  try {
    const args = parseArgs()
    const command = args._[0]

    switch (command) {
      case 'gen':
        const options = argsToGenerateOptions(args)
        await handleGenerate(options)
        break

      case 'test-generation':
        await testGenerationCommand(args.provider, args.model)
        break

      case 'list-providers':
        await listProvidersCommand()
        break

      case 'test-provider':
        await testProviderCommand(args.provider)
        break

      case 'show-provider-examples':
        await showProviderExamplesCommand()
        break

      case 'index-jsdoc':
        await indexJSDocCommand()
        break

      case 'clear-jsdoc':
        await clearJSDocIndexCommand()
        break

      case 'lock':
        handleLockUnlock(args.files, 'lock')
        break

      case 'unlock':
        handleLockUnlock(args.files, 'unlock')
        break

      default:
        console.error(`Unknown command: ${command}`)
        process.exit(1)
    }
  } catch (error) {
    console.error(
      'CLI Error:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    process.exit(1)
  }
}

// Run the CLI only if the script is executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  main()
}
