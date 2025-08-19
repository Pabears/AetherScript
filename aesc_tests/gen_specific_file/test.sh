#!/bin/bash

set -e

echo "--- Running Specific File Gen Test ---"

echo "-> Generating code for user-controller.ts only..."
bun $AESC_PATH gen src/user-controller.ts -v

echo "-> Checking generated files..."
if [ ! -f "src/generated/userservice.service.impl.ts" ]; then
    echo "FAIL: UserServiceImpl was not generated!"
    exit 1
fi
if [ ! -f "src/generated/db.service.impl.ts" ]; then
    echo "FAIL: DBImpl was not generated!"
    exit 1
fi
if [ -f "src/generated/orderservice.service.impl.ts" ]; then
    echo "FAIL: OrderServiceImpl was generated, but should not have been!"
    exit 1
fi
echo "-> File check passed."

echo "-> Running application..."
bun run start

echo "--- Specific File Gen Test Passed ---"
