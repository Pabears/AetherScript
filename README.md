# AetherScript Prototype: AI-Assisted Development You Can Trust

Tired of the "magic" and unpredictability of AI code generation? Do you love the power of LLMs but hate the messy diffs, the loss of control, and the "hallucinated" code that pollutes your pristine codebase?

What if we could collaborate with AI the same way we collaborate with human developers? With clear contracts, explicit reviews, and a process that guarantees human oversight?

This is the vision behind this project, a prototype for what we'll call **AetherScript**.

AetherScript introduces a new, structured workflow for human-AI collaboration, built on a simple yet powerful philosophy: **separate human intent from AI implementation.**

## 🚀 Recent Major Updates (v2.0)

### ✅ Complete Architecture Refactoring
- **Modular Design**: Refactored from a monolithic 400+ line `index.ts` to a highly modular architecture with dedicated modules for CLI, core generation, configuration, utilities, error handling, and logging
- **Improved Maintainability**: Code is now organized into logical modules (`src/cli/`, `src/core/`, `src/config/`, `src/utils/`, `src/errors/`, `src/logging/`)
- **Enhanced Extensibility**: New provider support and features can be easily added without touching core logic

### ✅ Multi-Provider AI Support
- **Cloudflare Workers AI**: Full support for Cloudflare's AI platform with automatic token optimization
- **Provider Abstraction**: Clean abstraction layer supporting multiple AI providers (Ollama, Cloudflare, extensible for more)
- **Intelligent Token Management**: Automatic prompt optimization for token-limited models (e.g., 32K context models)

### ✅ Smart Prompt Optimization
- **Provider-Aware Prompts**: Automatically adjusts prompt complexity based on the target AI provider's capabilities
- **Dynamic JSDoc Integration**: Enhanced third-party dependency detection with intelligent caching system
- **Comprehensive Documentation**: Full JSDoc injection for all providers ensures high-quality code generation

### ✅ Enhanced Developer Experience
- **Comprehensive Statistics**: Detailed timing and performance metrics for generation and testing
- **Improved Error Handling**: Robust error recovery with intelligent retry mechanisms
- **Better CLI**: More intuitive command structure with comprehensive help and examples

## Project Structure

This repository is organized into two main parts:

*   `aesc/`: The core AetherScript library and command-line tool.
*   `demo_simple/`: A simple example project that demonstrates how to use the `aesc` tool.

## Getting Started: Running the Demo

### Prerequisites

Before you begin, ensure you have the following installed:

- **Bun**: Follow the instructions on the [official Bun website](https://bun.sh/) to install it.
- **AI Provider**: Choose one of the supported providers:
  
  **Option 1: Ollama (Local)**
  - Download and install Ollama from the [official Ollama website](https://ollama.com/download)
  - Pull a model and ensure Ollama is running:
    ```bash
    # Download the default model
    ollama pull codellama
    
    # You can also pull other models
    ollama pull qwen2.5-coder:32b
    
    # Make sure Ollama is running in the background
    ```

  **Option 2: Cloudflare Workers AI (Remote)**
  - Set up environment variables:
    ```bash
    export CLOUDFLARE_ACCOUNT_ID="your-account-id"
    export CLOUDFLARE_API_TOKEN="your-api-token"
    ```

### Setup and Execution

To see AetherScript in action, follow these steps to set up the local development environment. This process uses `bun link` to simulate how a user would consume the `aesc` package.

1.  **Install Dependencies for Both Projects**

    ```bash
    cd aesc
    bun install
    cd ../demo_simple
    bun install
    ```

2.  **Build the `aesc` Tool**

    The `aesc` tool needs to be built once initially.

    ```bash
    cd ../aesc
    bun run build
    ```

3.  **Link the `aesc` Tool for Local Development**

    This is the key step. We'll first create a global link for the `aesc` package, and then consume that link in the `demo` project.

    First, in the `aesc/` directory (where you should be after the previous step), create the global link:
    ```bash
    # In the aesc/ directory, create the global link
    bun link
    ```

    Then, switch to the `demo/` directory and use the link:
    ```bash
    # In the demo/ directory, use the link
    cd ../demo
    bun link aesc
    ```

4.  **Run Code Generation in the Demo Project**

    Now, from the `demo_simple` directory, you can use the `aesc` command-line tool just like a published package.

    ```bash
    # Make sure you are in the demo_simple/ directory
    # This will use the default 'codellama' model with local Ollama
    bunx aesc gen -vf

    # You can specify a different model using the -m or --model flag
    # bunx aesc gen -vf -m qwen2.5-coder:32b
    
    # Use Cloudflare Workers AI (requires environment variables)
    # bunx aesc gen -vf -p cloudflare -m "@cf/qwen/qwen2.5-coder-32b-instruct"
    ```

    This command will scan your project for `@AutoGen` decorators and generate the necessary implementation files inside `src/generated`.

5.  **Run the Demo Application**

    ```bash
    bun run start
    ```

## 🔧 Advanced Usage

### Multi-Provider AI Support

AetherScript supports multiple AI model providers through a unified interface. You can easily switch between different providers without changing your code structure.

#### Available Providers

- **Ollama** (default): Local or remote Ollama instances
- **Cloudflare Workers AI**: Cloud-based AI models via Cloudflare with automatic token optimization

#### Provider Configuration

**Option 1: Environment Variables (Recommended)**

```bash
# For Cloudflare Workers AI
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_AIG_TOKEN="your-aig-token"  # Optional for AI Gateway

# For remote Ollama
export OLLAMA_ENDPOINT="http://your-remote-server:11434/api/generate"
```

**Option 2: Command Line Arguments**

```bash
# Use Cloudflare Workers AI
bunx aesc gen -vf -p cloudflare -m "@cf/qwen/qwen2.5-coder-32b-instruct"

# Use remote Ollama
bunx aesc gen -vf -p ollama -m "qwen2.5-coder:32b"

# Use local Ollama (default)
bunx aesc gen -vf -m "codellama"
```

### CLI Commands Reference

#### Core Generation Commands

```bash
# Generate implementations for all @AutoGen decorators
bunx aesc gen [files...] [options]

# Options:
#   -f, --force     Force overwrite existing files
#   -v, --verbose   Show detailed generation process
#   -m, --model     Specify AI model to use
#   -p, --provider  Specify AI provider (ollama, cloudflare)

# Examples:
bunx aesc gen -vf                                    # Generate all with verbose output
bunx aesc gen UserService -f                        # Generate specific service
bunx aesc gen -p cloudflare -m "@cf/qwen/qwen2.5-coder-32b-instruct"
```

#### Provider Management Commands

```bash
# List all available providers and their status
bunx aesc list-providers

# Test connection to a specific provider
bunx aesc test-provider [provider-name]

# Show provider configuration examples
bunx aesc provider-examples

# Test code generation with a specific provider/model
bunx aesc test-generation [provider] [model]
```

#### JSDoc Integration Commands

```bash
# Index JSDoc documentation for all dependencies
bunx aesc index-jsdoc [path]

# Clear JSDoc cache
bunx aesc clear-jsdoc [path]
```

#### File Management Commands

```bash
# Lock files to prevent regeneration
bunx aesc lock <paths...>

# Unlock previously locked files
bunx aesc unlock <paths...>
```

### Enhanced JSDoc Integration

AetherScript provides comprehensive JSDoc integration for better code generation:

- **Dynamic Documentation Loading**: Automatically loads and caches JSDoc documentation for all project dependencies
- **Intelligent Type Detection**: Detects third-party library usage and injects relevant API documentation
- **Fallback Mechanisms**: Gracefully handles missing documentation with basic type definitions
- **Smart Caching**: Efficient caching system reduces redundant documentation processing

# Use specific Ollama model
bunx aesc gen -vf -m qwen2.5-coder:32b

# Use remote Ollama (with OLLAMA_ENDPOINT set)
bunx aesc gen -vf -p ollama -m qwen2.5-coder:32b
```

#### Provider Management Commands

```bash
# List all available and configured providers
bunx aesc list-providers

# Test connection to a specific provider
bunx aesc test-provider cloudflare

# Show configuration examples
bunx aesc provider-examples

# Test code generation with a provider
bunx aesc test-generation cloudflare "@cf/qwen/qwen2.5-coder-32b-instruct"
```

#### Command Line Options

- `-p, --provider <name>`: Specify the AI provider (ollama, cloudflare)
- `-m, --model <model>`: Specify the model to use
- `-v, --verbose`: Enable verbose logging to see full prompts and responses
- `-f, --force`: Force overwrite existing implementation files

5.  **Run the Demo Application**

    ```bash
    bun run start
    ```

    You should see the output of the program, confirming that the generated code was correctly injected and used.

6.  **Run the Test Suite**

    The `demo/` directory includes a test script `test.sh` that repeatedly runs the code generation and execution process to check for consistency and errors.

    ```bash
    # Navigate to the demo directory if you are not already there
    cd demo
    ./test.sh
    ```

    The test script accepts the following optional parameters:

    *   `-n <number>`: Specifies the total number of test iterations. Defaults to `1000`.
    *   `-m <model_name>`: Specifies the model to use for code generation. Defaults to `codellama`.

    **Example Usage:**

    ```bash
    # Run the test suite for 50 iterations with the qwen2.5-coder:32b model
    ./test.sh -n 50 -m "qwen2.5-coder:32b"
    ```

## How It Works: The `@AutoGen` Model

The core philosophy is to **separate human intent from AI implementation.**

#### 1. You Define the Intent (e.g., in `demo/src/service/user-service.ts`)

You write your high-level architecture using abstract classes and interfaces. You mark the properties you want the AI to implement with the `@AutoGen` decorator.

```typescript
// demo/src/service/user-service.ts
import { AutoGen } from "aesc";
import { User } from "../entity/user";
import { DB } from "./db-service";

export abstract class UserService {
    @AutoGen
    public db?: DB;
    // 1. check: 3 < name.length < 15 and 0 <= age <= 120
    // 2. db.save(user)
    public abstract create(user: User): void;

    // find user by name from db
    public abstract findByName(name: string): User | undefined;
}
```

And in another file, you might have a controller that depends on this service:

```typescript
// demo/src/controller/user-controller.ts
import { AutoGen } from "aesc";
import { User } from "../entity/user";
import { UserService } from "../service/user-service";

export class UserController {
    @AutoGen
    public userService?: UserService;

    create(user: User): void {
        this.userService!.create(user);
    }
    find(name: string): User | undefined {
        return this.userService!.findByName(name)
    }
}
```

#### 2. AI Fills the Implementation (via `bunx aesc gen`)

The AetherScript engine (`aesc`) scans your code for `@AutoGen` decorators. For each one, it generates a concrete implementation (`UserServiceImpl`, `DBImpl`, etc.) in a separate, sandboxed `generated/` directory. It also creates a dependency injection container to manage these implementations.

#### 3. You Use the Generated Code (e.g., in `demo/src/index.ts`)

The AI's code never touches your handwritten files. You explicitly use the generated container to inject the implementations where needed. It's like a pull request from your AI partner, which you "merge" by writing the wiring code yourself.

```typescript
// demo/src/index.ts
import { UserController } from './controller/user-controller'
import { User } from './entity/user';
import { container } from './generated/container';

console.log('--- Application Start ---');

// 1. Create an instance of the controller
const userController = new UserController();

// 2. Use the container to get the generated service implementation
// This is the "autowiring" or "injection" step
userController.userService = container.get('UserService');

console.log('UserService has been injected into UserController.');

// 3. Create some data and call the controller's method
const newUser = new User('Alice', 30);
console.log(`Calling create with user: ${newUser.name}`);
userController.create(newUser);
console.log(userController.find(newUser.name))
console.log('--- Application End ---');
```

## Why This Approach?

*   **Full Control & Trust**: No more unpredictable code magically appearing in your files. You are always the final gatekeeper.
*   **Clean Git History**: The logic for code generation (`aesc.ts`) is versioned, and the generated code can be ignored or checked in, but it never pollutes the history of your handwritten business logic.
*   **Deep Toolchain Integration**: This approach is built on standard TypeScript tooling (`ts-morph`) and can be seamlessly integrated into your build process.
*   **A Structured Philosophy**: This isn't just a tool; it's a methodology for making AI a true, reliable partner in professional software engineering.

We believe this is the future of AI-assisted development—structured, predictable, and always developer-led.

## Reliability Testing

To ensure the stability and reliability of the `aesc` code generator, a series of stress tests were conducted using the `demo/test.sh` script. This script repeatedly runs the code generation and execution cycle to measure the consistency and success rate of different models.

### Test Results

#### `codellama:7b` (Baseline)

A recent stress test was conducted over 100 consecutive iterations. The results showed a significant number of failures, with a success rate even lower than previously observed:

```
--- Test Run Complete ---
Total Iterations: 100
Successful Runs:  57
Failed Runs:      43
-------------------------
Success Rate: 57.0%
```

This result confirms that the baseline model has significant issues with consistency and reliability under stress.

#### `qwen2.5-coder:32b` (Recommended)

The same test was performed with the `qwen2.5-coder:32b` model over 100 iterations. The results were flawless:

```
--- Test Run Complete ---
Total Iterations: 100
Successful Runs:  100
Failed Runs:      0
-------------------------
Success Rate: 100%
```

### Conclusion

The `qwen2.5-coder:32b` model demonstrates vastly superior reliability and consistency compared to the `codellama:7b` baseline. For any practical use, **`qwen2.5-coder:32b` is the recommended model** to ensure stable and predictable code generation.

### AetherScript vs. Standard Benchmarks

The reliability tests above show how different models perform *within the AetherScript framework*. But how does this compare to their performance on standard, unconstrained code generation benchmarks?

The table below contrasts the models' public `pass@1` scores (a standard metric for single-shot code generation success) with their success rates when guided by AetherScript. This highlights the value of providing a structured, context-aware framework for AI collaboration.

| Model                   | Standard Benchmark (`pass@1`) | AetherScript Success Rate |
| ----------------------- | ----------------------------- | ------------------------- |
| `codellama:7b`          | 28.7%¹                        | **57.0%**                 |
| `qwen2.5-coder:32b`     | 60.9%²                        | **100%**                  |

*¹ HumanEval `pass@1` score, as reported in community benchmarks.*
*² Code Editing `pass@1` score, as reported in the official Qwen2.5-Coder technical paper.*

As the data shows, AetherScript's structured approach dramatically improves the effective reliability of both models, turning even a moderately performing base model into a more consistent tool and elevating a high-performing model to near-perfect reliability for the given task.
