#!/bin/bash

set -e

echo "--- Running Lock/Unlock Test ---"

echo "-> Installing dependencies..."
bun install --silent

LOCKED_FILE="src/generated/userservice.service.impl.ts"

echo "-> Generating code for the first time..."
bun \$AESC_PATH gen -v

# Get the initial modification time of the file
MOD_TIME_1=\$(stat -c %Y "\$LOCKED_FILE")

echo "-> Locking the file: \$LOCKED_FILE"
bun $AESC_PATH lock "\$LOCKED_FILE"

# Wait a second to ensure the modification time will be different if the file is changed
sleep 1

echo "-> Trying to generate again with --force (should be blocked by lock)..."
bun $AESC_PATH gen -vm qwen2.5-coder:32b --force

# Get the modification time again
MOD_TIME_2=\$(stat -c %Y "\$LOCKED_FILE")

if [ "\$MOD_TIME_1" -ne "\$MOD_TIME_2" ]; then
    echo "FAIL: Locked file was modified!"
    exit 1
fi
echo "-> Locked file was not modified, as expected."

echo "-> Unlocking the file: \$LOCKED_FILE"
bun \$AESC_PATH unlock "\$LOCKED_FILE"

# Wait a second again
sleep 1

echo "-> Generating again with --force (should now succeed)..."
bun $AESC_PATH gen -vm qwen2.5-coder:32b --force

# Get the modification time for the final time
MOD_TIME_3=\$(stat -c %Y "\$LOCKED_FILE")

if [ "\$MOD_TIME_2" -eq "\$MOD_TIME_3" ]; then
    echo "FAIL: Unlocked file was not modified!"
    exit 1
fi
echo "-> Unlocked file was modified, as expected."

echo "--- Lock/Unlock Test Passed ---"