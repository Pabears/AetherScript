#!/bin/bash

set -e

BASE_DIR=$(pwd)
TEST_DIR="$BASE_DIR/aesc_tests"

echo "Base directory: $BASE_DIR"
echo "Test directory: $TEST_DIR"

# Define the path to the aesc executable
export AESC_PATH="$BASE_DIR/aesc/dist/index.js"

if [ ! -f "$AESC_PATH" ]; then
    echo "Aesc executable not found at $AESC_PATH"
    echo "Building aesc..."
    (cd "$BASE_DIR/aesc" && bun install && bun run build)
fi

echo "Aesc executable found at: $AESC_PATH"

run_test() {
    TEST_NAME=$1
    echo "--- Running test: $TEST_NAME ---"
    if (cd "$TEST_DIR/$TEST_NAME" && ./test.sh); then
        echo "--- Test $TEST_NAME PASSED ---"
    else
        echo "--- Test $TEST_NAME FAILED ---"
        exit 1
    fi
}

# --- Run all tests ---
run_test "gen_simple"
run_test "gen_force"
run_test "gen_specific_file"
run_test "provider_list"
run_test "provider_test"
run_test "lock_unlock"
run_test "jsdoc_index"

echo "All tests passed!"
