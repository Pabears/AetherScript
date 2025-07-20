#!/bin/bash

# Create a log file with a timestamp and redirect all output to it and the console.
LOG_FILE="test_run_$(date +'%Y%m%d_%H%M%S').log"
exec &> >(tee -a "$LOG_FILE")

echo "Test run started. Output will be saved to: $LOG_FILE"
echo "====================================================="

# Default number of runs
TOTAL_RUNS=1000

# Default model
MODEL="codellama"

# Default provider (empty means use default)
PROVIDER=""

# Parse command-line options
while getopts ":n:m:p:" opt; do
  case $opt in
    n)
      TOTAL_RUNS=$OPTARG
      ;;
    m)
      MODEL=$OPTARG
      ;;
    p)
      PROVIDER=$OPTARG
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

echo "Starting test with $TOTAL_RUNS iterations..."
if [ -n "$PROVIDER" ]; then
  echo "Using provider: $PROVIDER"
fi
echo "Using model: $MODEL"

# Counters for successful and failed runs
SUCCESS_COUNT=0
FAILURE_COUNT=0

# Loop for the specified number of times
for i in $(seq 1 $TOTAL_RUNS)
do
  echo "--- Running Test Iteration: $i/$TOTAL_RUNS ---"
  ITERATION_FAILED=0

  # Step 1: Generate code
  echo "-> Generating code with model: $MODEL..."
  # Capture stderr to check for errors, hide stdout
  if [ -n "$PROVIDER" ]; then
    GEN_ERROR=$(bun aesc gen -vf -p "$PROVIDER" -m "$MODEL" 2>&1 >/dev/null)
  else
    GEN_ERROR=$(bun aesc gen -vf -m "$MODEL" 2>&1 >/dev/null)
  fi
  if [ $? -ne 0 ]; then
    echo "[ERROR] 'bun aesc gen -vf' failed at iteration $i."
    echo "--- Generation Log ---"
    echo "$GEN_ERROR"
    echo "----------------------"
    ITERATION_FAILED=1
  fi

  # Step 2: Run the application and check its exit code (only if generation succeeded)
  # The test now relies on the exit code from index.ts, which contains assertions.
  if [ $ITERATION_FAILED -eq 0 ]; then
    echo "-> Running application with assertions..."
    # Capture output for logging in case of failure, but the success/failure is determined by the exit code.
    RUN_LOG=$(bun run start 2>&1)
    if [ $? -ne 0 ]; then
      echo "[ERROR] 'bun run start' exited with a non-zero status at iteration $i, indicating a test failure."
      echo "--- Run Log ---"
      echo "$RUN_LOG"
      echo "--------------- "
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
