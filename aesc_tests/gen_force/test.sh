#!/bin/bash

set -e

echo "--- Running Force Gen Test ---"

echo "-> Generating code for the first time..."
aesc gen -v

echo "-> Generating code again with --force..."
aesc gen -v --force

echo "-> Running application..."
bun run start

echo "--- Force Gen Test Passed ---"
