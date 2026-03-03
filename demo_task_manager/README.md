# AetherScript Demo: Task Manager

This is a demonstration project showcasing the **AetherScript** framework, transforming abstract interfaces into fully functional, tested code via AI.

## Getting Started

1. **Install Dependencies:**
   ```bash
   bun install
   ```

2. **Generate Implementations:**
   Run the newly optimized AetherScript generator to parse all `// @autogen` bounds and synthesize the business logic to `src/generated/`:
   ```bash
   /aesc-gen
   ```

3. **Generate Unit Tests:**
   Automatically build the boundary TDD test suites based on your abstract contracts using the local proxy-mock generator:
   ```bash
   /aesc-test
   ```

4. **Run the Validation Suite:**
   Execute the flawlessly generated `test/` suite:
   ```bash
   bun test test/
   ```

5. **Run the Application:**
   Start the main DI-injected demo application:
   ```bash
   bun run src/index.ts
   ```
