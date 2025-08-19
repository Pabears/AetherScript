import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import type { GenerateOptions } from '../types'
import { getConfig } from '../config'

export function parseArgs() {
  const config = getConfig()

  return yargs(hideBin(process.argv))
    .command('generate [files...]', 'Generate implementations for interfaces', (yargs) => {
      return yargs
        .positional('files', {
          describe: 'Glob patterns for files to process',
          type: 'string',
        })
        .option('provider', {
          alias: 'p',
          type: 'string',
          description: 'AI provider to use',
          default: config.defaultProvider,
        })
        .option('model', {
          alias: 'm',
          type: 'string',
          description: 'Model to use for generation',
          default: config.defaultModel,
        })
        .option('force', {
          alias: 'f',
          type: 'boolean',
          description: 'Force regeneration of all files',
          default: false,
        })
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          description: 'Enable verbose logging',
          default: false,
        })
    })
    .command('init', 'Initialize a new aesc.config.json file')
    .command('lock <files...>', 'Lock files to prevent regeneration')
    .command('unlock <files...>', 'Unlock files to allow regeneration')
    .command('providers', 'List available and configured providers')
    .command('test-provider [provider]', 'Test connection to a provider')
    .command('provider-examples', 'Show provider configuration examples')
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .alias('h', 'help')
    .parse()
}

export function getGenerateOptions(args: any): GenerateOptions {
  const config = getConfig()
  return {
    files: (args.files || []).map(String),
    provider: args.provider,
    model: args.model || config.defaultModel,
    force: args.force,
    verbose: args.verbose,
  }
}
