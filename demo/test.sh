#!/bin/bash

# The expected output from 'bun run start'
EXPECTED_OUTPUT="$ bun src/index.ts
--- Application Start ---
UserService has been injected into UserController.
Calling create with user: Alice
User {
  name: \"Alice\",
  age: 30,
}
--- Application End ---"

# Counters for successful and failed runs
SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_RUNS=1000

# Loop 1000 times
for i in $(seq 1 $TOTAL_RUNS)
do
  echo "--- Running Test Iteration: $i/$TOTAL_RUNS ---"
  ITERATION_FAILED=0

  # Step 1: Generate code
  echo "-> Generating code..."
  # Capture stderr to check for errors, hide stdout
  GEN_ERROR=$(bun aesc gen -vf 2>&1 >/dev/null)
  if [ $? -ne 0 ]; then
    echo "[ERROR] 'bun aesc gen -vf' failed at iteration $i."
    echo "--- Generation Log ---"
    echo "$GEN_ERROR"
    echo "----------------------"
    ITERATION_FAILED=1
  fi

  # Step 2: Run the application and capture the output (only if generation succeeded)
  if [ $ITERATION_FAILED -eq 0 ]; then
    echo "-> Running application..."
    ACTUAL_OUTPUT=$(bun run start 2>&1)
    if [ $? -ne 0 ]; then
      echo "[ERROR] 'bun run start' failed at iteration $i."
      echo "--- Run Log ---"
      echo "$ACTUAL_OUTPUT"
      echo "-------------"
      ITERATION_FAILED=1
    fi
  fi

  # Step 3: Compare the output (only if run succeeded)
  if [ $ITERATION_FAILED -eq 0 ]; then
    NORMALIZED_ACTUAL=$(echo "$ACTUAL_OUTPUT" | tr -d '\r' | tr -s '[:space:]')
    NORMALIZED_EXPECTED=$(echo "$EXPECTED_OUTPUT" | tr -d '\r' | tr -s '[:space:]')

    if [ "$NORMALIZED_ACTUAL" != "$NORMALIZED_EXPECTED" ]; then
      echo "[FAILURE] Output mismatch at iteration $i."
      echo "--- EXPECTED OUTPUT ---"
      echo "$EXPECTED_OUTPUT"
      echo "--- ACTUAL OUTPUT ---"
      echo "$ACTUAL_OUTPUT"
      echo "-----------------------"
      ITERATION_FAILED=1
    fi
  fi

  # Update counters
  if [ $ITERATION_FAILED -eq 1 ]; then
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
    echo "-> Iteration $i: FAILED"
  else
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo "-> Iteration $i: SUCCESS"
  fi
done

echo "

--- Test Run Complete ---"
echo "Total Iterations: $TOTAL_RUNS"
echo "Successful Runs:  $SUCCESS_COUNT"
echo "Failed Runs:      $FAILURE_COUNT"
echo "-------------------------"

if [ $FAILURE_COUNT -gt 0 ]; then
    exit 1
fi
