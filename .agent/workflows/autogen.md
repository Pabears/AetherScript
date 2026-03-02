---
description: Generate code for abstract classes marked with @autogen using Gemini
---

# AutoGen Workflow

This workflow runs the AutoGen skill to generate concrete implementations for your abstract classes.

## Prerequisites
- Bun runtime installed
- Gemini CLI authenticated (`gemini` command available)

## Steps

1. Run the autogen skill (from your project's src folder)
// turbo
bun ../.agent/skills/autogen/scripts/autogen.ts

## What it does
- Scans `src/` for abstract classes with `// @autogen` comments
- Generates implementations in `src/generated/`
- Creates a dependency injection container
- Uses caching for fast incremental builds

## Example
See `.agent/skills/autogen/examples/sample-service.ts` for the recommended pattern.
