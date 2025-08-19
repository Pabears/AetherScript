#!/usr/bin/env bun

/**
 * AetherScript - AI-Powered Code Generation
 *
 * This is the main entry point for the AetherScript CLI.
 * It sets up the command-line interface and delegates to the appropriate handlers.
 */

import { main } from './cli'

// Execute the main CLI function
main().catch((error: Error) => {
  console.error('AetherScript CLI failed:', error)
  process.exit(1)
})
