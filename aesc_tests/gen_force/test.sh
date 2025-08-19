#!/bin/bash

set -e

echo "--- Running Force Gen Test ---"

echo "-> Installing dependencies..."
bun install --silent

echo "-> Generating code for the first time..."
bun $AESC_PATH gen -vm qwen2.5-coder:32b

echo "-> Generating code again with --force..."
bun $AESC_PATH gen -vm qwen2.5-coder:32b --force

echo "-> Running application..."
bun run start

echo "--- Force Gen Test Passed ---"