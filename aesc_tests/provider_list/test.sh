#!/bin/bash

set -e

echo "--- Running List Providers Test ---"

echo "-> Running 'aesc list-providers'..."
OUTPUT=$(aesc list-providers)

echo "$OUTPUT"

echo "-> Checking for 'ollama'..."
echo "$OUTPUT" | grep -q "ollama"
echo "-> Checking for 'cloudflare'..."
echo "$OUTPUT" | grep -q "cloudflare"

echo "--- List Providers Test Passed ---"
