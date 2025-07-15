# AetherScript Prototype: AI-Assisted Development You Can Trust

Tired of the "magic" and unpredictability of AI code generation? Do you love the power of LLMs but hate the messy diffs, the loss of control, and the "hallucinated" code that pollutes your pristine codebase?

What if we could collaborate with AI the same way we collaborate with human developers? With clear contracts, explicit reviews, and a process that guarantees human oversight?

This is the vision behind this project, a prototype for what we'll call **AetherScript**.

AetherScript introduces a new, structured workflow for human-AI collaboration, built on a simple yet powerful philosophy: **separate human intent from AI implementation.**

## Project Structure

This repository is organized into two main parts:

*   `aesc/`: The core AetherScript library and command-line tool.
*   `demo/`: A simple example project that demonstrates how to use the `aesc` tool.

## Getting Started: Running the Demo

### Prerequisites

Before you begin, ensure you have the following installed:

- **Bun**: Follow the instructions on the [official Bun website](https://bun.sh/) to install it.
- **Ollama**: Download and install Ollama from the [official Ollama website](https://ollama.com/download). After installation, you must pull the model that `aesc` will use and ensure the Ollama application is running.

  ```bash
  # Download the default model
  ollama pull codellama

  # You can also pull other models to use with the --model flag
  ollama pull qwen2.5-coder:32b

  # Make sure the Ollama application is running in the background
  ```

### Setup and Execution

To see AetherScript in action, follow these steps to set up the local development environment. This process uses `bun link` to simulate how a user would consume the `aesc` package.

1.  **Install Dependencies for Both Projects**

    ```bash
    cd aesc
    bun install
    cd ../demo
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

    Now, from the `demo` directory, you can use the `aesc` command-line tool just like a published package.

    ```bash
    # Make sure you are in the demo/ directory
    # This will use the default 'codellama' model
    bunx aesc gen -vf

    # You can specify a different model using the -m or --model flag
    # bunx aesc gen -vf -m qwen2.5-coder:32b
    ```

    This command will scan your project for `@AutoGen` decorators and generate the necessary implementation files inside `src/generated`.

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
