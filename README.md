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

## Testing for Reliability

To ensure the stability and reliability of the `aesc` code generator, a stress test was conducted using the `codellama:7b` model. This test involves running the generation and execution cycle repeatedly.

A test script, `demo/test.sh`, was created to automate this process. It performs the following steps in a loop:
1.  Force-generates the code using `bun aesc gen -vf`.
2.  Runs the application using `bun run start`.
3.  Compares the output against a known, correct result.
4.  Logs successes and failures without stopping.

### Test Results

The script was run for 1,000 consecutive iterations. The final results were as follows:

```
--- Test Run Complete ---
Total Iterations: 1000
Successful Runs:  714
Failed Runs:      286
-------------------------
```

This result indicates that while the core functionality works, there is a significant failure rate under stress, highlighting areas for future improvement in the code generation's consistency and error handling.
