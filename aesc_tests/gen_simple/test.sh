#!/bin/bash

set -e

echo "--- Running Simple Gen Test ---"

echo "-> Generating code..."
bun $AESC_PATH gen -v

echo "-> Running application..."
bun run start

echo "--- Simple Gen Test Passed ---"
