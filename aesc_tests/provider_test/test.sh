#!/bin/bash

set -e

echo "--- Running Test Provider Test ---"

echo "-> Running 'test-provider -p ollama'..."
# This test assumes a local Ollama instance is running.
OUTPUT=$(bun $AESC_PATH test-provider -p ollama)

echo "$OUTPUT"

echo "-> Checking for success message..."
echo "$OUTPUT" | grep -q "Provider 'ollama' is configured correctly."

echo "--- Test Provider Test Passed ---"
