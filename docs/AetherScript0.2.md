AetherScript: A Framework for Trustworthy AI-Assisted Development
Core Philosophy: Separate Intent from Implementation, Embrace Contracts and Composition
In a world filled with AI coding tools, AetherScript takes a unique approach. It doesn't inject code directly into your source files, nor does it stop at simple code completion. AetherScript's core philosophy is to cleanly separate the developer's "design intent" from the AI's "implementation details," connecting them with strongly-typed "contracts" and composing them at runtime.

This paradigm solves the critical pain points of AI-driven development: the crisis of trust and the chaos of workflow. AetherScript establishes a structured, predictable, and developer-led collaborative process, turning AI into a reliable team member that respects your architecture.

The Workflow: A Modern Approach Based on Dependency Injection
AetherScript fully embraces the power of native TypeScript and modern software design patterns, particularly Dependency Injection (DI). The workflow is simple and elegant.

Step 1: Define the Contract
As the architect, you define a component's "contract" using an abstract class in a standard .ts file. This is where human intelligence shines—designing the system's architecture, its capabilities, and the skeleton of its business logic.

// File: src/user.ts
// The developer defines the capabilities of UserService without implementing it.
export abstract class UserService {
    // It depends on a DB contract.
    @AutoGen
    public db?: DB;

    // It defines two methods that must be implemented.
    abstract create(user: User): void;
    abstract findByName(name: string): User | undefined;
}

// The DB contract is also defined as an abstract class.
export abstract class DB {
    protected users = new Map<string, User>();
    abstract save(user: User): void;
    abstract find(name: string): User | undefined;
}

Step 2: Declare the Dependency
In higher-level components that need this functionality (like a UserController), you declare the dependency on the contract using the @AutoGen decorator. This tells the AetherScript engine, "I need a concrete implementation of UserService."

// File: src/user.ts
export class UserController {
    // Declare the need for a UserService implementation.
    @AutoGen
    public userService?: UserService;

    create(user: User): void {
        this.userService!.create(user);
    }

    find(name: string): User | undefined {
        return this.userService!.findByName(name);
    }
}

Step 3: AI Generates the Implementation
The AetherScript engine (aesc.ts script) scans for all @AutoGen decorators. For each one, it:

Parses its type (e.g., the UserService abstract class).

Builds a precise prompt containing this contract and any relevant context (like the User class definition) and sends it to an LLM (e.g., a local Ollama instance).

The AI generates a concrete implementation class (e.g., UserServiceImpl) that adheres to the contract and saves it to a separate, isolated src/generated directory.

This process is fully automated. The AI's output is always confined to the generated sandbox, never polluting your hand-crafted source code.

Step 4: Compose at Runtime
This is the most elegant part of the AetherScript workflow. While generating implementation classes, the aesc.ts script also creates a Dependency Injection (DI) container (src/generated/container.ts). This container knows about all the generated implementations and how they depend on each other (e.g., UserServiceImpl requires DBImpl).

You no longer need to merge code. At your application's entry point, you simply ask the container for the service you need.

// File: index.ts
import { UserController, User } from './src/user';
// Import the AI-generated container
import { container } from './src/generated/container';

// 1. Create an instance of your controller
const userController = new UserController();

// 2. "Inject" the dependency by getting it from the container
// The container automatically resolves all nested dependencies.
userController.userService = container.get('UserService');

// 3. Your application works as expected
const newUser = new User('Alice', 30);
userController.create(newUser);

The container.get() action gracefully replaces a build-time merge step. It transforms the act of "accepting" AI code from a physical file operation into a logical, runtime composition, which is both more flexible and more powerful.

Key Advantages
Embrace Standards, No Magic: Uses standard .ts files and abstract class, ensuring seamless compatibility with the entire TypeScript ecosystem (editors, linters, build tools).

Elegant & Modern Architecture: Built on Dependency Injection and Inversion of Control (IoC), cornerstones of modern enterprise application development. This makes unit testing trivial and enhances architectural scalability.

Clean Separation of Concerns: src/ is for human-authored design and blueprints; src/generated/ is for AI-authored implementations. Responsibilities are crystal clear. You can choose to commit the generated directory for review or ignore it and generate it on-the-fly in your CI/CD pipeline.

The Perfect Balance of Trust and Control: Trust is established through the strongly-typed contracts (abstract class) that the AI must follow. Control remains firmly in your hands—you decide when and where to enable the AI's implementation via container.get().

AetherScript proves that a new, more mature human-AI collaboration is possible. In this relationship, the developer is the architect, and the AI is the diligent engineer who follows the blueprints. This is not just a tool; it's an evolution in software engineering philosophy.

How to Run This Prototype
Prerequisites
Bun (v1.2.16 or later)

Ollama

Step 1: Install Dependencies
bun install

Step 2: Set Up the AI Model
This prototype uses the codellama model running locally via Ollama.

Download the model:

ollama pull codellama

Ensure Ollama is running.

Step 3: Generate AI Implementations & Container
Run the AetherScript core script. It will scan for @AutoGen decorators, call the LLM, and create all necessary implementation files and the container.ts file in the src/generated directory.

bun aesc.ts

Step 4: Run the Application
Execute the main application logic to see the DI container compose and serve the AI-generated code at runtime.

bun index.ts

You will see output in your console showing that the application successfully created and found a user, powered seamlessly by the AI-generated code.