#!/bin/bash

set -e

echo "--- Running JSDoc Index Test ---"

CACHE_DIR=".aether-cache"

echo "-> Installing dependencies..."
bun install

echo "-> Running 'index-jsdoc'..."
bun $AESC_PATH index-jsdoc

echo "-> Checking for cache directory..."
if [ ! -d "$CACHE_DIR" ]; then
    echo "FAIL: Cache directory '$CACHE_DIR' was not created!"
    exit 1
fi
echo "-> Cache directory found."

echo "-> Running 'clear-jsdoc'..."
bun $AESC_PATH clear-jsdoc

echo "-> Checking for cache directory removal..."
if [ -d "$CACHE_DIR" ]; then
    echo "FAIL: Cache directory '$CACHE_DIR' was not removed!"
    exit 1
fi
echo "-> Cache directory removed."

echo "--- JSDoc Index Test Passed ---"
