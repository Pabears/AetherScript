# AetherScript Prototype: AI-Assisted Development You Can Trust

Tired of the "magic" and unpredictability of AI code generation? Do you love the power of LLMs but hate the messy diffs, the loss of control, and the "hallucinated" code that pollutes your pristine codebase?

What if we could collaborate with AI the same way we collaborate with human developers? With clear contracts, explicit reviews, and a process that guarantees human oversight?

This is the vision behind this project, a prototype for what we'll call **AetherScript**.

AetherScript introduces a new, structured workflow for human-AI collaboration, built on a simple yet powerful philosophy: **separate human intent from AI implementation.**

## How It Works: The `@AutoGen` Model

This prototype demonstrates the core concept using TypeScript decorators and compile-time code generation.

#### 1. You Define the Intent (in your source code)

In standard TypeScript files, you write your high-level architecture, interfaces, and method signatures. You define the "what." For the parts you want to delegate to an AI, you simply apply the `@AutoGen` decorator to an interface property.

```typescript
// You write this in src/user.ts
import { AutoGen } from "./decorators";

export interface UserService {
    create(user: User): void;
}

export class UserController {
    @AutoGen
    public userService?: UserService;

    public create(user: User): void {
        this.userService?.create(user);
    }
}
```

#### 2. AI Fills the Implementation (`aesc.ts` script)

The AetherScript engine (represented by our `aesc.ts` script) scans your code for `@AutoGen` decorators. For each decorated property, it:
1.  Finds the associated interface (`UserService`).
2.  Generates a concrete implementation (`UserServiceImpl`) in a separate, sandboxed directory (`src/generated`). This is the "how."
3.  Generates a dependency injection container to make the implementation available at runtime.

#### 3. You Use the Generated Code (with full control)

The AI's code never touches your main source files. You explicitly use the generated container to inject the implementation where needed. It's like a pull request from your AI partner, which you merge by writing the wiring code yourself.

```typescript
// In your application entry point (index.ts)
import { UserController } from './src/user';
import { container } from './src/generated/container';

// You decide when and how to inject the AI-generated code
const userController = new UserController();
userController.userService = container.get('UserService');

// Now you can use the controller, powered by AI-generated logic
userController.create(new User('Alice', 30));
```

## Why This Approach?

*   **Full Control & Trust**: No more unpredictable code magically appearing in your files. You are always the final gatekeeper.
*   **Clean Git History**: The logic for code generation (`aesc.ts`) is versioned, and the generated code can be ignored or checked in, but it never pollutes the history of your handwritten business logic.
*   **Deep Toolchain Integration**: This approach is built on standard TypeScript tooling (`ts-morph`) and can be seamlessly integrated into your build process.
*   **A Structured Philosophy**: This isn't just a tool; it's a methodology for making AI a true, reliable partner in professional software engineering.

We believe this is the future of AI-assisted development—structured, predictable, and always developer-led.

## How to Run This Prototype

1.  **Install dependencies:**
    ```bash
    bun install
    ```
2.  **Install ollama and codellama:**

    1. download ollama: https://ollama.com/download
    2. install codellama
        ```bash
        ollama run codellama
        ```

3.  **Run the code generation script:**
    This will scan the `src` directory and create the `src/generated` files.
    ```bash
    bun aesc.ts
    ```

4.  **Run the main application:**
    This will execute the application logic using the generated code.
    ```bash
    bun index.ts
    ```

This project was created using `bun init` in bun v1.2.16. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
