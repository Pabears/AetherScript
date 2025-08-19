#!/bin/bash

set -e

echo "--- Running Simple Gen Test ---"

echo "-> Installing dependencies..."
bun install --silent

echo "-> Generating code..."
bun $AESC_PATH gen -vfm qwen2.5-coder:32b

echo "-> Running application..."
bun run start

echo "--- Simple Gen Test Passed ---"