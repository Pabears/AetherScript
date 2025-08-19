#!/bin/bash

set -e

BASE_DIR=$(pwd)
TEST_DIR="$BASE_DIR/aesc_tests"

echo "Base directory: $BASE_DIR"
echo "Test directory: $TEST_DIR"

# Define the path to the aesc executable
export AESC_PATH="$BASE_DIR/aesc/dist/index.js"

# --- Global Cleanup function (runs on script exit) ---
global_cleanup() {
    echo "--- Performing global cleanup of test directories ---"
    for test_case in "gen_simple" "gen_force" "gen_specific_file" "provider_list" "provider_test" "lock_unlock" "jsdoc_index"; do
        echo "Global cleaning $test_case..."
        rm -rf "$TEST_DIR/$test_case/node_modules" \
               "$TEST_DIR/$test_case/dist" \
               "$TEST_DIR/$test_case/generated" \
               "$TEST_DIR/$test_case/.jsdoc"
    done
    echo "--- Global cleanup complete ---"
}

# Trap to ensure global_cleanup runs on exit, regardless of success or failure
trap global_cleanup EXIT

# --- Test-specific Cleanup function (runs before each test) ---
test_cleanup() {
    local current_test_dir="$1"
    echo "--- Cleaning up $current_test_dir for fresh run ---"
    rm -rf "$current_test_dir/node_modules" \
           "$current_test_dir/dist" \
           "$current_test_dir/generated" \
           "$current_test_dir/.jsdoc"
    echo "--- Cleanup for $current_test_dir complete ---"
}


if [ ! -f "$AESC_PATH" ]; then
    echo "Aesc executable not found at $AESC_PATH"
    echo "Building aesc..."
    (cd "$BASE_DIR/aesc" && bun install && bun run build)
fi

echo "Aesc executable found at: $AESC_PATH"

run_test() {
    TEST_NAME=$1
    TEST_CASE_DIR="$TEST_DIR/$TEST_NAME" # Define the full path to the test case directory

    # Perform cleanup before running the test
    test_cleanup "$TEST_CASE_DIR"

    echo "--- Running test: $TEST_NAME ---"
    if (cd "$TEST_CASE_DIR" && ./test.sh); then
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
