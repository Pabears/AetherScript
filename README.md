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

// Define a User class
export class User {
    constructor(public name: string, public age: number) {}
}

// Define an abstract class for the database layer
export abstract class DB {
    protected users = new Map<string, User>();
    abstract save(user: User): void;
    abstract find(name: string): User | undefined;
}

// UserService is now an abstract class with its own auto-generated dependency
export abstract class UserService {
    @AutoGen
    public db?: DB;

    abstract create(user: User): void;
    abstract findByName(name: string): User | undefined;
}

// The controller now only needs the user service
export class UserController {
    @AutoGen
    public userService?: UserService;

    create(user: User): void {
        this.userService!.create(user);
    }

    find(name: string): User | undefined {
        return this.userService!.findByName(name);
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
import { UserController, User } from './src/user';
import { container } from './src/generated/container';

console.log('--- Application Start ---');

// 1. Create an instance of the controller
const userController = new UserController();

// 2. Use the container to get the generated UserService.
// The container will automatically resolve the nested dependency (DB -> UserService).
userController.userService = container.get('UserService');

console.log('UserService has been injected into UserController.');

// 3. Create some data and use the controller
const newUser = new User('Alice', 30);
userController.create(newUser);
console.log('Found user:', userController.find(newUser.name));

console.log('--- Application End ---');
```

## Why This Approach?

*   **Full Control & Trust**: No more unpredictable code magically appearing in your files. You are always the final gatekeeper.
*   **Clean Git History**: The logic for code generation (`aesc.ts`) is versioned, and the generated code can be ignored or checked in, but it never pollutes the history of your handwritten business logic.
*   **Deep Toolchain Integration**: This approach is built on standard TypeScript tooling (`ts-morph`) and can be seamlessly integrated into your build process.
*   **A Structured Philosophy**: This isn't just a tool; it's a methodology for making AI a true, reliable partner in professional software engineering.

We believe this is the future of AI-assisted development—structured, predictable, and always developer-led.

## How to Run This Prototype

### Prerequisites

Before you begin, ensure you have the following installed:
- [Bun](https://bun.sh/) (v1.2.16 or later)
- [Ollama](https://ollama.com/download)

### Step 1: Install Dependencies

Navigate to the project directory and install the necessary packages.

```bash
bun install
```

### Step 2: Set Up the AI Model

This prototype uses the `codellama` model running locally via Ollama.

1.  **Download the model:**
    ```bash
    ollama pull codellama
    ```

2.  **Ensure Ollama is running:**
    Make sure the Ollama application is running in the background. You should see its icon in your system's menu bar or taskbar.

### Step 3: Generate Code

Run the AetherScript code generation script. This will scan for `@AutoGen` decorators, interact with the LLM, and create the service implementation files in the `src/generated` directory.

```bash
bun aesc.ts
```

### Step 4: Run the Application

Execute the main application logic to see the generated code in action.

```bash
bun index.ts
```

You will see output showing that the `UserController` is using the `UserService` to create and find a user.

This project was created using `bun init` in bun v1.2.16. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
