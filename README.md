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
  # Download the model
  ollama pull codellama

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
    bunx aesc gen -vf
    ```

    This command will read `src/user.ts`, find the `@AutoGen` decorators, and generate the necessary implementation files inside `src/generated`.

5.  **Run the Demo Application**

    ```bash
    bun run start
    ```

    You should see the output of the program, confirming that the generated code was correctly injected and used.

## How It Works: The `@AutoGen` Model

The core philosophy is to **separate human intent from AI implementation.**

#### 1. You Define the Intent (in `demo/src/user.ts`)

You write your high-level architecture using abstract classes and interfaces. You mark the properties you want the AI to implement with the `@AutoGen` decorator.

```typescript
// demo/src/user.ts
import { AutoGen } from "aesc"; // Note: importing from the 'aesc' package

export class User { /* ... */ }
export abstract class DB { /* ... */ }

export abstract class UserService {
    @AutoGen // You're telling AetherScript to generate the implementation for this
    public db?: DB;

    abstract create(user: User): void;
    abstract findByName(name: string): User | undefined;
}

export class UserController {
    @AutoGen // And for this one too
    public userService?: UserService;

    create(user: User): void { /* ... */ }
    find(name: string): User | undefined { /* ... */ }
}
```

#### 2. AI Fills the Implementation (via `bunx aesc gen`)

The AetherScript engine (`aesc`) scans your code for `@AutoGen` decorators. For each one, it generates a concrete implementation (`UserServiceImpl`, `DBImpl`, etc.) in a separate, sandboxed `generated/` directory. It also creates a dependency injection container to manage these implementations.

#### 3. You Use the Generated Code (in `demo/src/index.ts`)

The AI's code never touches your handwritten files. You explicitly use the generated container to inject the implementations where needed. It's like a pull request from your AI partner, which you "merge" by writing the wiring code yourself.

```typescript
// demo/src/index.ts
import { UserController, User } from './user';
import { container } from './generated/container'; // You import the AI's work

const userController = new UserController();

// Use the container to get the generated implementation
userController.userService = container.get('UserService');

console.log('UserService has been injected into UserController.');

const newUser = new User('Alice', 30);
userController.create(newUser);
```

## Why This Approach?

*   **Full Control & Trust**: No more unpredictable code magically appearing in your files. You are always the final gatekeeper.
*   **Clean Git History**: The logic for code generation (`aesc.ts`) is versioned, and the generated code can be ignored or checked in, but it never pollutes the history of your handwritten business logic.
*   **Deep Toolchain Integration**: This approach is built on standard TypeScript tooling (`ts-morph`) and can be seamlessly integrated into your build process.
*   **A Structured Philosophy**: This isn't just a tool; it's a methodology for making AI a true, reliable partner in professional software engineering.

We believe this is the future of AI-assisted development—structured, predictable, and always developer-led.
