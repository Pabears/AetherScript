#!/usr/bin/env bash
set -e

# Add ~/.local/bin to PATH so 'agy' can be found when run by the agent sandbox
export PATH="$HOME/.local/bin:$PATH"

PROJECT_ROOT=$(pwd)
DEMO_DIR="$PROJECT_ROOT/demo"

echo "🚀 [E2E] Starting AetherScript End-to-End Demo Test..."

# 1. Cleanup Phase
echo "🧹 [1/4] Cleaning up demo project..."
rm -rf "$DEMO_DIR/src/generated"
rm -rf "$DEMO_DIR/test"
rm -f "$DEMO_DIR/aesc.lock"
rm -f "$DEMO_DIR/.aesc-scan.json"
echo "✅ Cleanup complete."

# 2. Scan Phase
echo "🔍 [2/4] Running scanner..."
bun src/scanner.ts --project demo
echo "✅ Scanner completed successfully."

# 3. Build Phase
echo "🏗️  [3/4] Running aesc-build (Parallel execution with Blind Judge)..."
bun src/aesc-build.ts --project demo
echo "✅ aesc-build completed successfully."

# 4. Verification Phase
echo "🧪 [4/4] Verifying generated code..."
cd "$DEMO_DIR"
echo "   -> Running bun test..."
bun test
echo "   -> ✅ Tests passed."

echo "   -> Generating DI Container..."
cd "$PROJECT_ROOT"
bun src/container-gen.ts --project demo
cd "$DEMO_DIR"
echo "   -> ✅ DI Container generated."

echo "   -> Running demo app (bun src/index.ts)..."
bun src/index.ts
echo "   -> ✅ Demo app executed successfully."

echo "✅ Verification completed successfully. Everything is perfectly reproducible!"
echo "🎉 [E2E] AetherScript E2E Demo Test finished beautifully!"
