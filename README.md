# AetherScript: Technical Design Specification for AI-Enhanced Development

# **Part 1: Vision & System Architecture**

### **1.1 The AetherScript Philosophy: Harmonizing Human Intent with AI Code Generation**

AetherScript is born from a core insight: while current Large Language Models (LLMs) demonstrate astonishing potential in code generation, their direct integration into professional software development workflows faces severe challenges. These include the unpredictability of code, potential security vulnerabilities ("hallucinated" code), and a disconnect from existing workflows. AetherScript does not aim to create an "autonomous" AI that completely replaces developers. Instead, it builds a structured collaborative framework that enables developers to precisely guide AI, treating AI-generated code as an auditable, versionable, and acceptable external dependency.

The core of this philosophy is the **"Acceptance Model."** In the AetherScript paradigm, the development process is explicitly divided into two phases: **Intent Definition** and **Implementation Filling**.

- **Intent Definition:** In `.as` (AetherSource) files, developers use familiar TypeScript code to outline the application's architecture, interfaces, and core business logic. In sections where a concrete implementation is needed but the logic is relatively tedious or boilerplate, developers place a **Method Placeholder**. This placeholder is not just a to-do marker; it is a precise instruction to the AI, defining the function's boundary—its method signature (parameters and return type).
- **Implementation Filling:** Based on the placeholders and context in the `.as` file, the AI generates the concrete function implementation in a corresponding `.asc` (AetherScript-Complete) file. This `.asc` file acts as a **Staging Area**, similar to staged changes in Git. The code here is temporary and pending review; it has not yet become part of the project's main branch.
- **Merge and Accept:** The developer reviews the AI-generated code in the `.asc` file. Once its quality, security, and correctness are confirmed, they can execute the `aesc merge` command. This command seamlessly injects the implementation from the `.asc` file into the `.as` file, replacing the original placeholder with a concrete function body to form the final, committable, and compilable TypeScript source code.

This process formalizes the introduction of AI code, making it analogous to a Code Review or handling a Pull Request. It enforces a manual review gate, fundamentally resolving the trust crisis caused by directly inserting AI-generated content into code. The existence of the `.asc` file provides a safe, isolated environment for developers to evaluate and iterate on the AI's output without polluting the main codebase. Therefore, the entire AetherScript toolchain, from the Command-Line Interface (CLI) to the Integrated Development Environment (IDE) extension, is designed around this core "review and accept" workflow, ensuring that human developers always maintain final control and decision-making authority.

### **1.2 Architectural Blueprint: The Ecosystem of .as, .asc, aesc, and the Bun Runtime**

The AetherScript ecosystem consists of multiple collaborating components that together transform intent into final code. The high-level architecture is depicted below, clearly showing the flow of data and control between the various components.

```
graph TD
    subgraph "Developer Environment"
        A[Developer in IDE] -- "1. Writes .as file" --> B(user.service.as);
        B -- "2. Includes placeholder ${...}" --> C{AetherScript Extension};
        C -- "3. Triggers 'Generate Code'" --> D[AI Generation Service];
        C -- "7. Displays custom Diff view" --> A;
        C -- "8. Executes 'aesc merge'" --> E[aesc CLI];
    end

    subgraph "AI & Compilation Core"
        D -- "4. Generates code" --> F(user.service.asc);
        E -- "9. Invokes core compiler" --> G[@aetherscript/compiler];
        H -- "11. Invokes core compiler" --> G;
    end

    subgraph "Runtime & Build"
        I[Bun Runtime] -- "10. 'bun dev' starts" --> H[Bun Plugin];
        H -- "12. Provides in-memory merged code" --> I;
        J[Final .ts file] -- "14. 'bun build'" --> K[Production Build Artifacts];
    end

    F -- "5. AI code written to .asc" --> C;
    B -- "6. Associates .as with .asc" --> C;
    G -- "13. Performs AST transformation" --> J;

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#ccf,stroke:#333,stroke-width:2px
    style G fill:#9cf,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5
    style I fill:#f96,stroke:#333,stroke-width:2px

```

**Component Descriptions:**

- **Developer IDE (VS Code):** The primary interface for developers. Through a dedicated AetherScript VS Code extension, developers get syntax highlighting for `.as` and `.asc` files, code suggestions, and the core "generate-review-merge" interaction features.
- **AI Generation Service:** An abstract server endpoint triggered via the IDE extension or CLI. It is responsible for receiving context (placeholders, method signatures, related type definitions), constructing a precise prompt, and calling an LLM (e.g., GPT-4o) to generate code.
- **aesc CLI Tool:** The manual control plane for AetherScript. It provides a series of commands like `merge`, `validate`, and `generate` for managing AetherScript files locally or in a CI/CD environment. `aesc merge` is the critical step for finalizing code and committing it to version control.
- **Bun Runtime & Plugin:** To provide an exceptional development experience, AetherScript is deeply integrated with Bun. A custom Bun plugin works in `bun dev` mode to perform **on-the-fly** in-memory merging of `.as` and `.asc` files. This means developers can see the final effect at runtime without manually running the `merge` command, achieving a seamless development loop.

**Core Architectural Decision: The Duality of the Compiler Engine**

A key consideration in designing this architecture is the functional overlap between the `aesc merge` command and the `bun dev` plugin. Both need to parse `.as` and `.asc` files, perform Abstract Syntax Tree (AST) transformations, and inject AI-generated code into the human-written template. Implementing this logic separately for the CLI and the Bun plugin would inevitably lead to code duplication, maintenance difficulties, and the risk of inconsistent behavior—the effect seen during development might differ slightly from the final merged code, which is unacceptable for any development tool.

Therefore, this design specification establishes a core architectural principle: **Abstract the code transformation logic into an independent, reusable core package: `@aetherscript/compiler`**.

This core package will contain all logic related to AST parsing, transformation, code injection, and source map generation. Both the `aesc` CLI tool and the `@aetherscript/bun-plugin` will act as consumers of this core package. This design ensures:

- **Single Source of Truth:** The merge logic exists in only one place, guaranteeing that the on-the-fly preview in `bun dev` is functionally identical to the final output of `aesc merge`.
- **Modularity and Testability:** The core compiler can be tested independently to ensure its robustness, while the CLI and Bun plugin focus on handling their respective I/O and environment integration issues.
- **Extensibility:** If support for other runtimes (like Node.js) or build tools (like Vite) is desired in the future, one only needs to create a new plugin that depends on `@aetherscript/compiler`, greatly enhancing the system's portability.

This decision elevates AetherScript from a simple scripting tool to a well-structured, maintainable compilation system, laying a solid foundation for its long-term stability and growth.

## **Part 2: Language Specification & File Formats**

### **2.1 The .as (AetherSource) File: Syntax and Semantics of Method Placeholders**

The `.as` file is the starting point of the AetherScript workflow, where developers define the system's structure and intent. Syntactically, it is a fully valid TypeScript file, allowing the use of any TypeScript feature. Its special characteristic is the introduction of the **Method Placeholder** concept.

**Syntax Specification:**

A method placeholder must be a **String Literal**, and its content must strictly follow this format:

`"${<object>.<method>(<args>)}"`

- `"${...}"`: The placeholder must be enclosed in double quotes and start and end with a `$` and curly braces `{...}`. This makes it a syntactically valid template string, but its special format allows the AetherScript compiler to identify it precisely.
- `<object>`: Represents the object to which the method belongs. In a class method, this is typically `this`. For top-level functions, it could be a module name or omitted.
- `<method>`: Represents the name of the method to be implemented by the AI.
- `<args>`: Represents the list of arguments passed to the method. These arguments must correspond to the parameters of the outer method containing the placeholder, so the AI can understand the context.

**Semantics and Context:**

The semantics of a placeholder are determined by its surrounding context. It is essentially an "implementation delegate" for its enclosing function or method. The compiler determines its type contract (i.e., parameter types and return type) by analyzing the **nearest enclosing function or method declaration**.

**Example `.as` File:**

The following `user.service.as` file demonstrates the typical usage of an `.as` file. The developer defines the `UserService` class and the signatures of two public methods, `create` and `getById`, but delegates the concrete implementation logic to the AI.

```
// src/services/user.service.as
import { User, UserCreateInput } from '../types/user.types';
import { PrismaClient } from '@prisma/client';
// Assume db instance is initialized and exported elsewhere
import { db } from '../db';

export class UserService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = db;
  }

  /**
   * Creates a new user.
   * @param data - The data required to create a user.
   * @returns The created user object.
   */
  public async create(data: UserCreateInput): Promise<User> {
    // AetherScript: AI, please implement the user creation logic based on the input data,
    // including data validation, password hashing, and database insertion.
    return "${this.create(data)}";
  }

  /**
   * Gets user information by ID.
   * @param id - The user's unique identifier.
   * @returns The found user object, or null if not found.
   */
  public async getById(id: string): Promise<User | null> {
    // AetherScript: AI, please implement the database logic to query a user by ID.
    return "${this.getById(id)}";
  }
}

```

In this example:

- The placeholder `"${this.create(data)}"` in the `create` method inherits the signature of the `create` method, meaning it needs to accept a `data` parameter of type `UserCreateInput` and return a `Promise<User>`.
- The placeholder `"${this.getById(id)}"` inherits the signature of the `getById` method.

Developers can provide more detailed natural language instructions to the AI through comments, which will be extracted and used when generating the prompt.

### **2.2 The .asc (AetherScript-Complete) File: Structure and Conventions for AI-Generated Code**

The `.asc` file is the "implementation companion" to the `.as` file, specifically for storing function bodies generated by the AI. It is also a standard TypeScript file that follows strict structural and naming conventions to ensure the AetherScript compiler can parse and map it correctly.

**File Structure:**

The `.asc` file consists of a series of exported functions. Each function directly corresponds to a placeholder in the `.as` file.

**Naming Convention:**

To uniquely map placeholders to functions in the `.asc` file and avoid naming conflicts, AetherScript employs a **Name Mangling** scheme.

- The placeholder `"${this.create(data)}"` will be mapped to an exported function named `this_create`.
- The placeholder `"${userService.getById(id)}"` will be mapped to `userService_getById`.

This `object_method` format ensures that even if there are multiple methods with the same name in the same file (e.g., in different classes), a unique function name can be generated. This conversion process is handled automatically by the `aesc` toolchain.

**Metadata and Documentation:**

To enhance traceability and maintainability, each AI-generated function should include standard JSDoc comments with embedded AetherScript-specific metadata.

- `@aether-prompt`: Records the core natural language prompt used to generate this code snippet.
- `@aether-model`: Records the LLM model used to generate the code (e.g., `gpt-4o`).
- `@aether-timestamp`: Records the generation timestamp.

This metadata is crucial for debugging, reproducing issues, and future model performance analysis. The IDE extension can parse this metadata and display it to the developer in the UI.

**Example `.asc` File:**

Corresponding to the `user.service.as` from the previous section, the AI-generated `user.service.asc` file might look like this:

```
// src/services/user.service.asc
import { User, UserCreateInput } from '../types/user.types';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * @aether-prompt Implement user creation logic based on input data, including data validation, password hashing, and database insertion.
 * @aether-model gpt-4o
 * @aether-timestamp 2025-08-15T10:30:00Z
 */
export async function this_create(
  // Note: The 'this' parameter is handled internally by the compiler, representing the class instance context.
  // The AI does not need to worry about this; it only needs to focus on business parameters.
  prisma: PrismaClient,
  data: UserCreateInput
): Promise<User> {
  if (!data.email || !data.password) {
    throw new Error('Email and password are required.');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const newUser = await prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
    },
  });

  // Remove the password field from the returned user object for security.
  const { password, ...result } = newUser;
  return result as User;
}

/**
 * @aether-prompt Implement the database logic to query a user by ID.
 * @aether-model gpt-4o
 * @aether-timestamp 2025-08-15T10:32:15Z
 */
export async function this_getById(
  prisma: PrismaClient,
  id: string
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return null;
  }

  const { password, ...result } = user;
  return result as User;
}

```

In this example, the AI not only implemented the database operations but also introduced the `bcrypt` library for password hashing and handled security details like sanitizing the returned data. The `.asc` file includes all necessary `import` statements, which will be intelligently merged into the final `.as` file during the `merge` process.

### **2.3 The Syntactic Contract: Ensuring Cohesion**

The `.as` and `.asc` files do not exist in isolation; they are tightly linked by a strict **Syntactic Contract**. This contract ensures a seamless connection between the human-defined interface and the AI-generated implementation. The core responsibility of the `aesc validate` command is to verify that this contract is upheld.

**Contract Rules:**

1. **Existence Contract:** For every method placeholder in an `.as` file, there must be a corresponding exported function in the `.asc` file that follows the naming convention. Conversely, every function in the `.asc` file should correspond to a placeholder in the `.as` file (unless it's a helper function).
2. **Type Compatibility Contract:** This is the most critical rule. The signature of the function generated in the `.asc` file (parameter types and return type) must be **type-compatible** with the signature of the method containing the placeholder in the `.as` file.

Simply matching function names and parameter counts is far from sufficient. The real contract lies in the type system. A method declared as `(id: string): Promise<User>` in `.as` cannot have its corresponding AI implementation be `(id: number): Promise<string>`. This type mismatch is a source of compile-time errors and must be caught before the `merge`.

**Using Type Checking as a Contract Guarantee**

To achieve this, the AetherScript toolchain must go beyond simple text replacement and become a **Type-Aware** system. The `aesc validate` and `aesc merge` commands will utilize the TypeScript compiler's own programmatic API to perform a cross-file type check before execution.

The internal process is as follows:

1. **Create a Virtual Project:** The `aesc` tool creates a temporary TypeScript project in memory.
2. **Simulate the Merge:** It temporarily replaces the placeholders in the `.as` file with calls to the corresponding functions in the `.asc` file. For example, `return "${this.create(data)}";` would be replaced with `return this_create(this.prisma, data);`.
3. **Type Check:** It calls the TypeScript compiler's `getPreEmitDiagnostics()` method on this virtual project. This method performs a full type check and reports any mismatches.
4. **Report Results:** If `getPreEmitDiagnostics()` returns any errors, it means the type contract has been violated. The `validate` command will fail and report detailed type errors to the user (e.g., "Argument of type 'any' is not assignable to parameter of type 'UserCreateInput'."). The `merge` command will also be aborted.

In this way, AetherScript transforms TypeScript's powerful static type system into an automated contract that guarantees the quality of human-AI collaboration. This not only prevents low-level coding errors but, more importantly, ensures that AI-generated code strictly adheres to the architectural and interface constraints set by human developers, making the entire development process both flexible and reliable. `aesc validate` thus becomes a crucial quality gate in the CI/CD pipeline.

## **Part 3: The AetherScript Compiler Engine (aesc)**

At the heart of AetherScript is a powerful compiler engine responsible for parsing, transforming, and generating code. This engine, named `@aetherscript/compiler`, is the underlying dependency shared by the `aesc` CLI tool and the Bun plugin. This section delves into its technical choices, core algorithms, and key implementation details.

### **3.1 Foundational Technology: A Comparative Analysis of TypeScript Compiler API vs. ts-morph**

To programmatically modify TypeScript code, one must manipulate its Abstract Syntax Tree (AST). There are currently two mainstream technical solutions: using the official TypeScript Compiler API directly, or using `ts-morph`, a high-level wrapper library.

- **TypeScript Compiler API (tsc):** This is the lowest-level, most authoritative API. It provides all the necessary functions for accessing and creating AST nodes. Its advantage is that it is feature-complete and always in sync with the TypeScript language version. However, its API is very verbose and complex. Making simple modifications, such as adding an import or replacing an expression, requires manually creating nodes, handling parent-child relationships, and updating the source file text, which is extremely error-prone and inefficient.
- **ts-morph:** `ts-morph` is a wrapper library built on top of the tsc API, designed to provide a simpler, more object-oriented interface for manipulating the AST. It wraps AST nodes in easy-to-use classes and provides a wealth of convenient manipulation methods, such as `node.replaceWithText()`, `sourceFile.addImportDeclaration()`, and `class.addMethod()`. Developers don't need to worry about the low-level details of node creation and replacement, allowing them to focus more on implementing business logic. Furthermore, `ts-morph` automatically updates the AST's state after modifications, greatly simplifying complex refactoring tasks.

**Technical Decision:**

**This project will adopt `ts-morph` as the core technology for the `@aetherscript/compiler` engine.**

The reasons for this decision are as follows:

- **Development Efficiency:** The API design of `ts-morph` greatly simplifies AST manipulation. For a project like AetherScript, which requires frequent code injection and replacement, using `ts-morph` can save a significant amount of development time and reduce bugs introduced by manual AST operations.
- **Code Readability:** Code based on `ts-morph` (e.g., `classNode.addMethod(...)`) is more concise and easier to understand and maintain than the equivalent tsc API code (which requires manually calling a series of functions like `factory.createMethodDeclaration`).
- **Powerful Abstraction:** `ts-morph` elegantly handles many tricky details, such as maintaining AST consistency after modifications, automatically formatting code, and managing relationships between source files.
- **Low-Level Access:** When needed, `ts-morph` still allows developers to access the underlying tsc nodes (via the `.compilerNode` property), providing flexibility and a fallback option.

Although using the tsc API directly might offer slightly better performance in some extreme cases, for AetherScript, the improvements in development efficiency and code maintainability far outweigh the minor performance differences.

### **3.2 The Transpilation Pipeline: Parsing .as and .asc into Abstract Syntax Trees (AST)**

The first step of the compiler engine is to parse the input source files. The transpilation pipeline of `@aetherscript/compiler` will follow these steps:

1. **Create a Project Instance:** All operations begin with a `ts-morph` `Project` instance. This instance represents the complete context of a TypeScript project, including all source files, `tsconfig.json` configuration, and type information.
    
    ```
    import { Project } from "ts-morph";
    const project = new Project({
      // Can load the project's tsconfig.json to get the correct compiler options
      tsConfigFilePath: "path/to/tsconfig.json",
    });
    
    ```
    
2. **Add Source Files:** Add the `.as` file to be processed and its corresponding `.asc` file to the project. It is crucial to place them in the same `Project` instance, as this allows `ts-morph` (and the underlying tsc) to resolve and understand the type reference relationships between the two files, which is a prerequisite for type-safe merging.
    
    ```
    const sourceFileAs = project.addSourceFileAtPath('src/user.service.as');
    const sourceFileAsc = project.addSourceFileAtPath('src/user.service.asc');
    
    ```
    
3. **Get the AST:** Once the files are added to the project, `ts-morph` automatically parses them internally, generating the AST. Developers can then start traversing and manipulating the AST through the `sourceFileAs` and `sourceFileAsc` `SourceFile` objects. During the development and debugging of the compiler engine, tools like `ts-ast-viewer` can be used to visualize the AST structure, which is very helpful for understanding node types and relationships.

### **3.3 The Core `merge` Operation: Deep Dive into AST Manipulation**

The `merge` operation is the soul of the `@aetherscript/compiler` engine. It is a sophisticated AST transformation process, not simple string concatenation. Here are its detailed algorithmic steps:

1. **Parse and Prepare:** As described in section 3.2, obtain the `SourceFile` objects for `sourceFileAs` and `sourceFileAsc`.
2. **Identify Placeholders:** Iterate through all `MethodDeclaration` nodes in `sourceFileAs`. Within each method body, search for `StringLiteral` nodes and check if their text content matches the AetherScript placeholder format `"${...}"`.
    
    ```
    // Pseudocode
    for (const method of sourceFileAs.getClasses()[0].getMethods()) {
      const returnStatement = method.getBody().getLastStatement();
      if (returnStatement.getKind() === SyntaxKind.ReturnStatement) {
        const placeholderNode = returnStatement.getExpression();
        if (isAetherScriptPlaceholder(placeholderNode.getText())) {
          // ... proceed to the next step
        }
      }
    }
    
    ```
    
3. **Map and Extract AI Function:** Based on the placeholder content (e.g., `this.create(data)`), determine the corresponding function name in `sourceFileAsc` using the name mangling rule (e.g., converting to `this_create`). Then, get the `FunctionDeclaration` node for that function from `sourceFileAsc`.
    
    ```
    const ascFunctionName = mangleName(placeholderText);
    const aiFunctionNode = sourceFileAsc.getFunctionOrThrow(ascFunctionName);
    
    ```
    
4. **Dependency Analysis and Injection:** The AI-generated function likely depends on external modules (like `bcrypt` or a database client). These dependencies must also be migrated to the final `.as` file.
    - **Extract Dependencies:** Analyze the body of `aiFunctionNode` to find all referenced external symbols and trace them back to the `ImportDeclaration`s at the top of `sourceFileAsc`. `ts-morph` provides powerful APIs for analyzing symbol references.
    - **Inject Dependencies:** Use the `sourceFileAs.addImportDeclaration()` method to add these `ImportDeclaration`s to the top of the `.as` file. `ts-morph` will automatically handle duplicate imports, ensuring the final file is clean.
5. **Implementation Injection:** Inject the AI-generated function body into the `.as` file. To maintain good encapsulation, the best practice is to inject it as a **private method** of the class containing the placeholder.
    - Get the `ClassDeclaration` node in the `.as` file.
    - Use the `classDeclaration.addMethod()` method to create a new private method. The structure of this method (name, parameters, return type, body) is completely copied from `aiFunctionNode`. To avoid naming conflicts, the new injected private method name can retain the mangled name, for example, `#this_create` (using ECMAScript's private field syntax).
6. **Placeholder Replacement:** This is the final step of the transformation. Replace the original placeholder string literal with a call to the newly injected private method.
    - Use the `placeholderNode.replaceWithText()` method to complete the replacement.
    - For example, `return "${this.create(data)}";` will be replaced with `return this.#this_create(data);`. The arguments passed to the private method should be consistent with the original method's parameters.
7. **Format and Save:** After all AST transformations are complete, call `sourceFileAs.formatText()` to beautify the code using TypeScript's built-in formatter. Finally, call `sourceFileAs.save()` to write the modified content back to disk.

**Note:** An important feature of `ts-morph` is that after performing a destructive operation like `replaceWithText`, the original node object becomes invalid. You must use the new node object returned by the operation for subsequent actions, or an error will be thrown.

### **3.4 Maintaining Debuggability: Generating Advanced Source Maps for AetherScript**

Standard JavaScript Source Maps solve the problem of mapping from minified, obfuscated production code (JS) back to the development source code (TS). However, AetherScript's `merge` process is a TS-to-TS transformation, which introduces a new debugging challenge: when a developer stops at a line of AI-generated code in the debugger, they see the merged code, but their mental model is of the original `.as` file and its simple placeholder. Standard source maps cannot bridge this semantic gap.

To solve this problem, AetherScript will implement an innovative **dual-layer source mapping strategy**.

1. **Standard JS Source Map (`.js.map`):** This layer is handled by standard tools (like Bun or tsc). After `aesc merge` is completed, when the final `.ts` file is compiled into JavaScript, a standard `.js.map` file is generated. This file is responsible for handling the line/column mapping from TS to JS for use by browser debuggers.
2. **AetherScript Content Map (`.as.map`):** This is unique to AetherScript. When `aesc merge` is executed, the `@aetherscript/compiler` engine will additionally generate a custom JSON-formatted mapping file, for example, `user.service.as.map`. This file does not care about the physical location of the code but records the mapping relationship between **Semantic Blocks**. Its design is inspired by Content Source Maps and the Source Map v3 specification but is simplified and specialized for AetherScript's use case.

**.as.map Format Specification:**

```
{
  "version": "1.0",
  "sourceAs": "./user.service.as",
  "sourceAsc": "./user.service.asc",
  "mappings": {
    "this_create": {
      "placeholder": "${this.create(data)}",
      "location": {
        "file": "./user.service.as",
        "line": 25,
        "column": 12
      }
    },
    "this_getById": {
      "placeholder": "${this.getById(id)}",
      "location": {
        "file": "./user.service.as",
        "line": 35,
        "column": 12
      }
    }
  }
}

```

- `version`: The version of the mapping file format.
- `sourceAs`, `sourceAsc`: Pointers to the original `.as` and `.asc` files.
- `mappings`: An object where the keys are the generated function names (mangled) in the `.asc` file, and the values are objects containing:
    - `placeholder`: The full string of the original placeholder.
    - `location`: The precise location (file, line, column) of the placeholder in the original `.as` file.

**The Role of `.as.map`:**

This custom mapping file is not designed for browsers but is **specifically for the AetherScript VS Code extension**. It empowers the IDE with a deep understanding of the code transformation process, enabling a series of advanced developer experience (DX) features:

- **Bidirectional Navigation:** When the cursor is on the `#this_create` function in the merged code, the IDE can read `.as.map`, find that its source is the placeholder on line 25 of `user.service.as`, and provide a "Go to Original Placeholder" link. And vice versa.
- **Enhanced Hover Information:** Hovering over the merged code can display the original placeholder and the `@aether-prompt` used to generate that code.
- **Intelligent Diff View:** The custom diff view (see Part 7) can use this mapping file to precisely align the placeholder on the left with the function body on the right.

In this way, `.as.map` ensures that AetherScript's abstraction remains consistent and "does not leak" throughout the entire development and debugging lifecycle, greatly enhancing the coherence and intuitiveness of the development experience.

## **Part 4: AI Code Generation Subsystem**

AI code generation is the core driving force of AetherScript. The design goal of this subsystem is not just to call an LLM API, but to build a robust, controllable, and high-quality generation process. It covers the complete lifecycle from context extraction and prompt engineering to code validation and state management.

### **4.1 The Generation Workflow: From Placeholder to Verifiable Implementation**

The entire generation process is a carefully orchestrated sequence designed to maximize the accuracy and relevance of the generated code.

**Workflow Sequence Diagram:**

```
sequenceDiagram
    participant User
    participant VSCodeExt as "VS Code Extension"
    participant PromptEngine as "Prompt Engine"
    participant LLM_API as "LLM API (e.g., GPT-4o)"
    participant ASC_File as ".asc File"

    User->>VSCodeExt: Clicks "Generate Code" CodeLens on a placeholder
    VSCodeExt->>VSCodeExt: 1. Parse .as file (using ts-morph)
    VSCodeExt->>PromptEngine: 2. Extract context (placeholder, method signature, type definitions, comments)
    PromptEngine->>PromptEngine: 3. Construct structured prompt (Persona, CoT, Security)
    PromptEngine->>LLM_API: 4. Send generation request
    LLM_API-->>PromptEngine: 5. Return generated code string
    PromptEngine->>VSCodeExt: 6. Pass along the generated code
    VSCodeExt->>VSCodeExt: 7. (Optional) Run ESLint to validate the code
    VSCodeExt->>ASC_File: 8. Write/update formatted code to the .asc file
    VSCodeExt-->>User: 9. Notify user of completion and refresh UI

```

This process ensures that every generation is based on rich context and that the output undergoes a preliminary automated quality check before being written to a file.

### **4.2 Prompt Architecture: Engineering High-Fidelity, Context-Aware Prompts**

The quality of the prompt directly determines the quality of the generated code. A vague prompt will only yield mediocre or even incorrect code. Therefore, AetherScript must adopt a systematic **Prompt Engineering** strategy, combining multiple advanced techniques to construct high-fidelity prompts.

**Components of a Structured Prompt:**

- **Persona Prompting:** Assign a clear expert role to the LLM to guide its output style and technical choices. This is the opening part of the prompt.
    - **Example:** "You are a senior TypeScript backend engineer with extensive experience in building scalable and secure REST APIs using the Bun runtime and Prisma ORM. Your code is clean, well-documented, follows SOLID principles, and prioritizes security."
- **Context Injection:** This is the core of the prompt, providing the LLM with all the information needed to solve the problem.
    - **Task Description:** The natural language requirement extracted from the JSDoc comments above the placeholder in the `.as` file.
    - **Function Signature:** The complete target function signature must be provided, including parameter names, types, and the return type. This is key for the LLM to understand the input/output contract.
    - **Type Definitions:** Recursively include the TypeScript definitions of all custom types referenced in the function signature (e.g., `User`, `UserCreateInput`).
    - **Project-Level Constraints:** Provide key information about the project's tech stack and architectural patterns. For example, by analyzing `package.json` or configuration files, you can inform the LLM: "This project uses `zod` for validation. Please add input validation logic using `zod`."
- **Chain-of-Thought & Step-by-Step Instructions:** Guide the LLM to think and generate code in logical steps, rather than outputting everything at once. This significantly improves the correctness of complex logic.
    - **Example:** "Generate the implementation for the function below. Follow these steps:
        1. First, write down the plan as a series of comments.
        2. Then, implement input validation to ensure the 'data' object is not empty and the email is valid.
        3. Next, hash the password using the 'bcrypt' library.
        4. After that, use the Prisma client to insert the new user into the database.
        5. Handle potential database errors, such as a unique constraint violation on the email address, by throwing a custom 'DuplicateUserError'.
        6. Finally, return the newly created user object, but make sure to exclude the password hash from the returned object for security."
- **Security Constraints:** Explicitly instruct the LLM to follow secure coding best practices, directly referencing risks from standards like the OWASP LLM Top 10.
    - **Example:** "Security Requirements:
        - **No SQL Injection:** All database queries MUST be performed through the Prisma ORM. Do not construct raw SQL queries from user input.
        - **Secure Output Handling:** Do not include sensitive information like password hashes in the API response.
        - **Input Validation:** Rigorously validate all user-provided data before processing."
- **Output Formatting:** Require the LLM to return the result as a pure code block, without any explanatory text, to facilitate programmatic parsing.

Through this multi-layered, structured prompt architecture, AetherScript can make the developer's implicit knowledge and project constraints explicit, thereby guiding the LLM to generate more reliable code that better conforms to project specifications.

### **4.3 State Management: .asc as a Staging Area and the "Acceptance" Model**

The role of the `.asc` file in AetherScript is far more than just a code container; it is a core **state management artifact**. It should be included in Git for version control because it represents "AI contributions pending review."

Thinking of the `.asc` file as a **"task list"** provides a clear mental model for the developer.

- When a placeholder needs an implementation, a corresponding function appears in the `.asc` file, which is equivalent to a "to-do task."
- The developer reviews the code and may ask the AI to regenerate it (updating the task) or directly modify the `.asc` file (editing the task).
- When the developer is satisfied with the implementation and executes `aesc merge`, this action represents "completing the task."

To maintain this mental model, the `aesc merge` command should **automatically remove the function from the `.asc` file** after successfully injecting it into the `.as` file. This design is crucial because it provides a clear state transition:

- **A function in the `.asc` file:** Represents a "pending" or "in-progress" AI generation task.
- **An empty `.asc` file:** Represents that all AI tasks have been completed and integrated into the main codebase.

This mechanism makes the state of the `.asc` file a clear indicator of project progress. This also requires the `aesc` toolchain to provide corresponding state management commands:

- `aesc regenerate <method>`: Discards the current implementation of a function in `.asc` and triggers the AI to regenerate it.
- `aesc discard <method>`: Removes the implementation of a function from `.asc`, effectively canceling the task.

This workflow transforms the process of AI collaboration from chaotic to orderly, making it a manageable and traceable part of the development process.

### **4.4 Code Validation: Programmatic Linting of Generated Code with ESLint**

Before AI-generated code is presented to the developer or merged into the main branch, it must pass through an automated quality gate. AetherScript will integrate ESLint to achieve this.

**Implementation Plan:** The `@aetherscript/compiler` engine and the VS Code extension will utilize the **Node.js API of the ESLint class** to programmatically lint the generated code string.

```
import { ESLint } from 'eslint';

async function validateGeneratedCode(codeAsString: string): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({
    useEslintrc: false, // Do not use the project's .eslintrc to ensure a pure validation environment
    overrideConfig: {
      // Define a strict, shared AetherScript base configuration here
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        'no-console': 'warn',
        // ... other rules
      },
    },
  });
  const results = await eslint.lintText(codeAsString);
  return results;
}

```

**Integration Strategy:**

- **Post-Generation Validation:** After the LLM returns the code, the VS Code extension will immediately call `validateGeneratedCode`. If there are errors, the code will not be written to the `.asc` file. Instead, the errors will be shown to the user with an option to "Use this code anyway (ignore errors)" or "Regenerate."
- **Self-Correction Loop:** A more advanced strategy is to feed the linting errors back to the LLM and ask it to correct its own code if linting fails.
    - **Feedback Prompt Example:** "The code you generated has the following linting errors: [...lint errors...]. Please fix these errors and provide the corrected code."
- **Pre-Merge Validation:** The `aesc merge` command will also run linting on the code in `.asc` again before performing the AST merge, serving as a final line of defense.

This proactive, automated code quality check ensures that only code that meets basic coding standards reaches the developer's review, greatly increasing the efficiency of the overall workflow.

### **4.5 Advanced Topic: Complex Logic Synthesis with Multi-Agent Systems (e.g., MetaGPT)**

For simple, atomic function implementations, a single LLM call is usually sufficient. But for more complex placeholders, such as `"${this.implement_complete_e-commerce_checkout_flow()}"`, a single prompt can hardly cover all the details, easily leading to a decline in generation quality.

To address such complex tasks, AetherScript's future roadmap will explore integrating **multi-agent collaboration frameworks** like MetaGPT or AutoGen. These frameworks decompose and solve complex problems by simulating the organizational structure of a software company, with different AI agents playing specific roles and collaborating.

**Envisioned Multi-Agent Architecture in AetherScript:**

When the AetherScript system encounters a placeholder marked with `@aether-complex`, it will no longer directly call an LLM. Instead, it will initiate a multi-agent task:

1. **AetherScript Orchestrator (Project Manager):** Parses the high-level requirements and breaks them down into sub-tasks, distributing them to different specialized agents.
2. **Architect Agent:** Designs data structures, API endpoints, and core component interfaces based on the requirements. Its output will be TypeScript type definitions and interface declarations.
3. **Engineer Agent:** Receives the interfaces defined by the architect and writes the concrete implementation code for each interface. This may involve generating multiple smaller functions.
4. **QA Agent:** Writes unit and integration tests for the code generated by the engineer to verify its correctness.
5. **Documentation Agent:** Writes JSDoc comments and Markdown documentation for the generated APIs and functions.

The outputs of all agents are finally integrated by the Orchestrator to form a structurally complete collection containing code, tests, and documentation, which is then used to populate the `.asc` file (or a set of related files).

This approach elevates AetherScript from a code **generation** tool to a software **synthesis** platform. Although this is a long-term vision, it demonstrates the extensibility of the AetherScript architecture and its immense potential in solving increasingly complex software engineering problems.

## **Part 5: Command-Line Interface (CLI) & Developer Workflow**

The `aesc` command-line interface is one of the core interaction tools for AetherScript, providing a powerful, scriptable control plane for developers and CI/CD systems. A well-designed, feature-rich CLI is crucial for the project's success.

### **5.1 Framework Choice & Architecture: Building a Robust CLI with Oclif**

To build a professional, extensible CLI, choosing the right framework is the first step. There are several excellent Node.js CLI frameworks available, such as Commander.js, Yargs, and Oclif.

- **Commander.js:** Lightweight and easy to use, suitable for quickly building simple CLI tools. However, its plugin system is relatively weak, limiting its extensibility for complex applications.
- **Yargs:** Powerful, known for its declarative syntax and rich built-in features (like command suggestions, middleware). It's more complex than Commander but offers stronger argument parsing and validation capabilities.
- **Oclif (Open CLI Framework):** Developed by Heroku, designed specifically for building large, pluggable CLI applications. It has native TypeScript support, provides powerful scaffolding tools to quickly generate commands and plugins, and has a mature plugin architecture.

**Technical Decision:**

**The AetherScript CLI (aesc) will be built on the Oclif framework.**

The reason for choosing Oclif is that its features are highly aligned with AetherScript's long-term vision:

- **Native TypeScript Support:** Oclif was designed for TypeScript from the ground up, which perfectly matches AetherScript's tech stack and ensures type safety across the entire toolchain.
- **Powerful Plugin System:** AetherScript may extend to more features in the future (e.g., integrating different LLM providers, supporting new languages). Oclif's plugin architecture allows these features to be developed and distributed as independent plugins, keeping the core CLI clean and modular.
- **Enterprise-Grade Features:** Oclif is used to build large CLIs like Heroku and Salesforce, proving its stability and maturity in handling complex command structures, auto-generating help documentation, and managing lifecycles.
- **Development Efficiency:** Oclif's scaffolding command `npx oclif generate command <name>` can quickly create new command files, automating many tedious setup tasks and allowing developers to focus on implementing command logic.

**CLI Framework Comparison**

| **Feature** | **Commander.js** | **Yargs** | **Oclif** |
| --- | --- | --- | --- |
| **Ease of Use** | Very simple, gentle learning curve | Declarative API, feature-rich, moderate learning curve | Steeper learning curve, but highly structured |
| **TypeScript Support** | Supported, but requires manual type configuration | Supported, but type integration is not as native as Oclif | First-class citizen, native support |
| **Plugin System** | Limited, mainly extended via custom commands | Supported via middleware, no formal plugin architecture | Core feature, very powerful and easy to extend |
| **Use Case** | Simple to moderately complex CLIs | Complex CLIs requiring advanced argument parsing/validation | Large, extensible, enterprise-grade CLI applications |

This comparison clearly shows that Oclif is the best choice for building a CLI for a platform like AetherScript, which aims to be a complete development platform. The CLI's architecture will follow Oclif's best practices, with each command being a separate class inheriting from `@oclif/core`'s `Command` base class and relying on the previously defined `@aetherscript/compiler` core package to perform the actual operations.

### **5.2 Command Specification**

The `aesc` CLI will provide a set of POSIX-compliant and semantically clear commands to cover the entire lifecycle of AetherScript.

**AetherScript CLI Command Specification**

| **Command** | **Arguments/Options** | **Description** |
| --- | --- | --- |
| `aesc init` |  | Initializes AetherScript in the current project. Creates an `aether.config.json` file and suggests adding relevant entries to `.gitignore`. |
| `aesc generate [path]` | `--method <name>`<br>`--model <id>`<br>`--force` | Triggers AI code generation for the `.as` file at the specified path (or for a specific method). `[path]` is optional; if omitted, all configured files are processed. `--method` specifies generating only a single method. `--model` allows overriding the default LLM. `--force` will force regeneration of existing code. |
| `aesc merge [path]` | `--all`<br>`--yes` | Merges reviewed code from the `.asc` file into the corresponding `.as` file. The `--all` option processes all files in the project. `--yes` skips the interactive confirmation prompt. This command is a key part of the CI/CD process. |
| `aesc validate [path]` | `--ci` | Validates the syntactic contract (existence and type compatibility) between `.as` and `.asc` files. This is another critical CI/CD command for static checking before merging. In `--ci` mode, it will report errors with a non-zero exit code. |
| `aesc watch` |  | Starts a daemon process that watches for changes in `.as` and `.asc` files. Based on configuration, file changes can automatically trigger `generate` or `validate` commands, providing real-time development feedback. |
| `aesc status` |  | Displays the status of all AetherScript files in the current project, such as which placeholders have not yet had implementations generated and which implementations have been generated but not yet merged. |
| `aesc discard [path]` | `--method <name>` | Discards one or more pending implementations in the `.asc` file, removing them from the file. |

The design of these commands aims to provide a powerful toolset that is suitable for both interactive use (e.g., a developer running `aesc generate` locally) and automated scripting (e.g., running `aesc validate` in a Git pre-commit hook).

### **5.3 Integration with Version Control Systems**

AetherScript's workflow naturally aligns with version control systems like Git. For the best experience, the following configurations and practices are recommended:

**.gitignore Configuration:**

The core philosophy of AetherScript is to **include both the intent (`.as`) and the pending implementation (`.asc`) in version control**. This allows code reviews to be conducted directly on the AI's output.

A typical `.gitignore` configuration should look like this:

```
# AetherScript
# If the final merged files are generated into a separate directory, they should be ignored.
# This line is not needed if the .as file is modified in-place.
# /dist_merged/

# Ignore AetherScript's cache and temporary files
.aether_cache/

```

**Code Review (Pull Request) Workflow:**

The `aesc merge` command is designed to produce very clear and meaningful diffs in version control.

- **Before Change:** `user.service.as` contains a placeholder, while `user.service.asc` contains a complete function implementation.
- **After `aesc merge`:**
    - The diff for `user.service.as` will clearly show the placeholder being replaced by a concrete private method and a call to it.
    - The diff for `user.service.asc` will show the corresponding function being removed.

This atomic change allows reviewers to very intuitively see the entire process of "an AI task being completed." They can easily compare the `.as` file before and after the change to confirm that the injected logic is correct, while the clearing of the `.asc` file also marks the closure of that task. This provides a powerful, tool-based guarantee for team collaboration and code quality control.

## **Part 6: Runtime Integration with Bun**

To achieve the modern development experience users expect from `bun run` and `bun dev`, AetherScript must be deeply integrated with the Bun runtime. This is primarily achieved through a custom Bun plugin that handles on-the-fly code merging and Hot Module Replacement (HMR) when the development server is running.

### **6.1 AetherScript's Universal Bun Plugin: Design and Implementation**

Bun provides a universal plugin API that can extend both its runtime and its bundler. The core goal of the AetherScript plugin is to intercept import requests for `.as` files and transform them in memory into a complete, executable TypeScript module.

**Plugin Design:**

The plugin will leverage Bun's `onLoad` lifecycle hook. This hook allows us to provide custom loading logic for specific file types (matched via the `filter` option).

```
// aetherscript-bun-plugin.ts
import type { BunPlugin } from 'bun';
import { AetherScriptCompiler } from '@aetherscript/compiler'; // Assuming the core compiler

export const aetherScriptPlugin = (): BunPlugin => {
  // Create a compiler instance when the plugin is initialized
  const compiler = new AetherScriptCompiler({
    // ... compiler options, e.g., project root
  });

  return {
    name: 'AetherScript Plugin',
    async setup(build) {
      // Intercept loading requests for all files ending in .as
      build.onLoad({ filter: /\.as$/ }, async (args) => {
        const asPath = args.path;
        const ascPath = asPath.replace(/\.as$/, '.asc');

        try {
          // Call the core compiler engine to perform an in-memory merge
          const mergedCode = await compiler.mergeInMemory(asPath, ascPath);

          // Return the merged code as the module's content to Bun
          return {
            contents: mergedCode,
            loader: 'ts', // Tell Bun to treat the content as TypeScript
          };
        } catch (error) {
          console.error(`AetherScript Error merging ${asPath}:`, error);
          // On error, return the original file content with an error message
          const originalContent = await Bun.file(asPath).text();
          return {
            contents: `console.error("AetherScript compilation failed for ${asPath}");\n${originalContent}`,
            loader: 'ts',
          };
        }
      });
    },
  };
};

```

**Implementation Highlights:**

- **Depends on Core Compiler:** The plugin itself does not contain complex AST manipulation logic; it relies entirely on the `@aetherscript/compiler` package, following the single responsibility principle.
- **`onLoad` Hook:** Uses `filter: /\.as$/` to precisely capture requests for AetherScript source files.
- **In-Memory Merge:** The `compiler.mergeInMemory` method will perform the same logic as `aesc merge`, but instead of writing to disk, it returns the merged code string directly.
- **Return Content and Loader:** The `onLoad` callback returns an object containing `contents` (the merged code) and `loader: 'ts'`. This instructs Bun's internal transpiler to process and execute the content we provide as TypeScript source code.

With this plugin, the separation of `.as` and `.asc` files is completely transparent to the Bun runtime. When Bun encounters `import { UserService } from './user.service.as'`, the plugin intervenes and provides an executable version that already includes all the AI implementations.

### **6.2 The `bun dev` Experience: On-the-Fly Merging and Hot Module Replacement (HMR)**

The core of modern web development is a fast feedback loop, and HMR is a key technology in that loop. Bun provides powerful HMR support through its `--hot` mode. The AetherScript plugin must integrate deeply with this mechanism to provide a seamless development experience.

**HMR Challenges and Solutions:**

Standard HMR is based on file dependencies. When `foo.ts` changes, `index.ts` which depends on it, is hot-updated. But in AetherScript, there is an indirect dependency: the developer modifies the `.asc` file (AI implementation), but expects to see the running `.as` file (human intent) updated. Bun's file watcher cannot understand this logical association on its own.

To solve this, the plugin must actively manage the HMR dependency graph.

**Implementation Strategy:**

1. **Establish Dependency:** When the `onLoad` hook processes an `.as` file, the plugin must not only return the merged code but also inform Bun's HMR system that this `.as` module "depends on" the corresponding `.asc` file. Although Bun's plugin API doesn't currently have a direct `this.addWatchFile` (like Vite), this can be achieved through the logic of `handleHotUpdate` (or more granular hooks in the future).
2. **Custom HMR Handling:** The plugin needs to implement HMR handling logic. When Bun detects a change in an `.asc` file, it will trigger an update. The AetherScript plugin needs to capture this update event.
3. **Programmatic Triggering of Updates:** In the HMR handling logic, when a change in `user.service.asc` is detected, the plugin needs to find all `.as` modules that depend on it (in this case, `user.service.as`) and **programmatically invalidate those `.as` modules**. This will force Bun's HMR runtime to reload them.
4. **Re-execution of `onLoad`:** The reloading of the `.as` module will re-trigger the plugin's `onLoad` hook, which will read the updated content of the `.asc` file, perform a new in-memory merge, and provide the latest code to Bun.

Bun's HMR API (`import.meta.hot`) provides client-side event listeners (like `bun:beforeUpdate`) and data persistence capabilities (`hot.data`). The AetherScript plugin will primarily interact with the HMR server on the server side (within the plugin's `setup` function) to manage the module graph and trigger updates. Although this process is complex, it is essential for achieving a truly "magical" development experience. When a developer saves an `.asc` file, the application state in the browser will update without a full refresh, as if they had directly modified the final logic.

### **6.3 Production Workflow: `bun run build` and Static Asset Generation**

Unlike the dynamic nature of the development environment, the production build process prioritizes determinism and repeatability.

**Build Process:**

The production build will be a two-stage process, orchestrated by scripts in `package.json`:

```
{
  "scripts": {
    "build": "aesc merge --all && bun build ./src/index.ts --outdir ./dist",
    "start": "bun run ./dist/index.js",
    "dev": "bun --hot run src/index.ts"
  },
  "dependencies": {
    //...
  },
  "devDependencies": {
    "@aetherscript/cli": "latest",
    "@aetherscript/bun-plugin": "latest"
    //...
  }
}

```

1. **Stage One: Pre-merge:** Before executing `bun build`, the `build` script first runs `aesc merge --all`. This command iterates through all AetherScript files in the project, merges all implementations from `.asc` files into their corresponding `.as` files, and **writes the results to disk**. This step transforms the entire project into a standard TypeScript project without any AetherScript placeholders.
2. **Stage Two: Standard Build:** After `aesc merge` is complete, the `bun build` command takes over. It will compile, bundle, and optimize the merged files just like any normal TypeScript project, ultimately generating production-ready JavaScript code in the `./dist` directory.

The advantages of this workflow are:

- **Decoupling:** The build process is decoupled from AetherScript's dynamic features. What's passed to `bun build` is pure TypeScript, requiring no special plugins or configurations.
- **Portability:** The generated merged code can be processed by any standard TypeScript toolchain (like `tsc`, `Vite`, `Webpack`), avoiding lock-in to the Bun ecosystem.
- **Determinism:** The build result in a CI/CD environment is completely deterministic because it operates on static, merged files, eliminating any uncertainty that might be introduced by dynamic merging during development.

## **Part 7: Providing a Superior Developer Experience (DX) through IDE Integration (VS Code)**

For a development tool like AetherScript, IDE integration is not an add-on feature; it is a manifestation of its core value. A seamless, intuitive IDE experience can transform AetherScript's abstract concepts into a developer's muscle memory. This section details the plan for a Visual Studio Code extension that will serve as the primary interface for developers to interact with the AetherScript ecosystem.

### **7.1 AetherScript's VS Code Extension Architecture**

The AetherScript VS Code extension will be a feature-rich package designed to provide an immersive, integrated development environment. Its main components include:

- **Syntax Highlighting:** Provide custom TextMate grammar files (`.tmLanguage`) for `.as` and `.asc` files to ensure correct code coloring and to highlight special AetherScript placeholders.
- **Language Server:** Implement the Language Server Protocol (LSP) to provide the IDE with advanced language features such as code completion, hover information, and go-to-definition. This is the "brain" of the extension.
- **Custom UI and Commands:** Embed AetherScript's core workflow (generate, review, merge) directly into the editor UI through CodeLens, status bar items, custom views, and the command palette.

### **7.2 Language Server Protocol (LSP) Implementation Plan**

We will build a dedicated AetherScript Language Server that runs as a separate Node.js process and communicates with VS Code via LSP. This server will deeply leverage `@aetherscript/compiler` and the custom `.as.map` source map files to provide context-aware features.

**LSP Feature Implementation Plan**

| **Feature** | **Implementation Strategy** | **Priority** |
| --- | --- | --- |
| **Go to Definition** | - When a user triggers "Go to Definition" on a placeholder in an `.as` file, the LSP parses the placeholder, finds the corresponding `.asc` file and function, and moves the cursor to that function.<br>- When triggered on an AI-generated method (e.g., `#this_create`) in a *merged* `.as` file, the LSP reads the `.as.map` file, finds the original placeholder location for that method, and moves the cursor back to it. | High |
| **Hover Information** | - Hovering over a placeholder in an `.as` file displays a popup with the full code of the corresponding function from the `.asc` file (including JSDoc) for a quick preview.<br>- Hovering over a merged AI-generated method displays the original placeholder string and the `@aether-prompt` metadata used to generate the code. | High |
| **Diagnostics** | The LSP continuously runs the logic of `aesc validate` in the background. When it detects a contract violation between `.as` and `.asc` files (like a type mismatch or missing implementation), it sends diagnostic information to VS Code, marking the error with a red or yellow squiggle in the code and providing a detailed error description. | High |
| **Code Completion** | When a developer types `"${this."` inside a string, the LSP can analyze the current class context and provide a list of method names in that class that can be replaced by a placeholder, reducing manual errors. | Medium |
| **Rename** | This is an advanced feature. When a user renames a method containing a placeholder (e.g., `create`) in an `.as` file, the LSP needs to perform a complex multi-file transaction:<br>1. Rename the method in `.as`.<br>2. Update the placeholder string content in `.as`.<br>3. Rename the corresponding function in `.asc` (e.g., `this_create` -> `this_newCreateName`).<br>This requires precise AST editing across multiple files. | Medium |
| **Inline Completion** | Utilize VS Code's `InlineCompletionItemProvider` API. When a developer finishes writing a method signature and is about to write a placeholder, it can suggest a complete placeholder string as ghost text, similar to GitHub Copilot. | Low |

### **7.3 Interactive UI with CodeLens: "Generate," "Accept," and "Regenerate" Actions**

CodeLens is a UI paradigm in VS Code that embeds actionable links directly above code, making it perfectly suited for AetherScript's workflow.

**CodeLens States and Actions:**

The extension will provide dynamic CodeLens links for each method in an `.as` file, with content that changes based on the current state:

- **Initial State (No Implementation):** If a method contains a placeholder but there is no implementation in the corresponding `.asc` file, the CodeLens will display: `[✨ Generate Code]`. Clicking this link will execute `vscode.commands.executeCommand('aetherscript.generate', ...)` to trigger the AI code generation process.
- **Pending Review State (Implementation Exists, Not Merged):** If a corresponding implementation exists in `.asc`, the CodeLens will display a set of actions: `[✅ Accept Merge] [🔍 View Diff] [🔄 Regenerate]`
    - **View Diff:** Opens a custom diff view (detailed in 7.4).
    - **Accept Merge:** Executes the `aesc merge` command to inject the method's implementation and updates the UI.
    - **Regenerate:** Discards the current implementation in `.asc` and re-triggers AI generation.
- **Merged State:** Once a method is merged, the placeholder disappears, and the CodeLens will change accordingly, perhaps showing a simple message or providing a link like "Jump to Git History": `[✓ Merged from AI]`.

This context-aware interaction seamlessly integrates AetherScript's core operations into the developer's daily coding activities, significantly reducing the learning curve and friction of use.

### **7.4 Custom Diff Viewer for Enhanced Code Review**

Standard text diff tools (like `git diff`) are inadequate for reviewing AetherScript's `merge` operations. They show a massive difference as the `.as` file changes from a version with a placeholder string to one with a large block of code, which is overwhelming and not focused enough for understanding the specific work done by the AI.

To solve this, the AetherScript extension will implement a **Custom Diff Viewer**.

**Semantic Comparison Beyond Text Comparison:**

The core idea of this custom view is to **compare "intent" with "implementation"** rather than comparing two versions of text files. When the user clicks the `[🔍 View Diff]` CodeLens, the extension will use the `vscode.diff` command or a lower-level Webview API to create a custom editor view.

- **Left Pane:** Will display the full content of the `.as` file but will highlight the specific method and its placeholder currently under review. This provides the reviewer with full context.
- **Right Pane:** Will **only display the function from the `.asc` file that corresponds to that placeholder**. It will not show other functions or import statements from the `.asc` file, thereby focusing the reviewer's attention entirely on the implementation logic being reviewed.

**Technical Implementation:**

1. The extension registers a custom command, e.g., `aetherscript.showDiff`.
2. When `View Diff` is clicked, this command is called, passing the `.as` file path and method name.
3. The command handler reads the content of the `.as` and `.asc` files.
4. It uses `vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title)` to open the diff view.
5. Here, `leftUri` and `rightUri` do not point directly to files on disk but to **Virtual Documents** created by the extension. The extension controls the content of these virtual documents by implementing a `TextDocumentContentProvider`.
6. The content of the left virtual document is the original text of the `.as` file. The content of the right virtual document is the code snippet of the target function, parsed and extracted.

This diff view, tailor-made for AetherScript, elevates the code review experience from tedious text comparison to an efficient, logic-focused validation process, perfectly supporting AetherScript's core "review and accept" philosophy.

## **Part 8: Future Roadmap & Advanced Concepts**

The initial version of AetherScript will focus on building a stable and efficient human-AI collaborative development framework. However, its architecture is designed to allow for extensive future intelligence and feature expansion. This section explores some forward-looking concepts that outline AetherScript's long-term evolution as a next-generation development platform.

### **8.1 Proactive Refactoring Suggestions through User Modeling and Telemetry**

The current AetherScript workflow is passive: the developer requests, and the AI responds. A future AetherScript could become more **proactive**, evolving into an intelligent partner that learns and adapts.

**Core Idea:** By collecting anonymous usage telemetry data, AetherScript can build a context-aware model of "what constitutes good code." This data includes:

- Which AI-generated code patterns are frequently modified or refactored manually by developers?
- Which generated code snippets are deleted or replaced shortly after being merged?
- Which code suggestions are accepted directly by developers, and which are rejected?

**Implementation Path:**

1. **Telemetry Collection:** Integrate an optional, privacy-respecting telemetry system into the VS Code extension. It would collect non-personally identifiable data about interactions with AI-generated code (e.g., type of refactoring operation, patterns of modified AST nodes).
2. **User Modeling:** Use this data to train a small machine learning model, either in the cloud or locally. The goal of this model is not to generate code but to **identify "code smells"** and patterns that do not conform to a specific team's coding style.
3. **Proactive Suggestions:** This model can be integrated back into the IDE extension. When it detects an improvable pattern in AI-generated code (or even human-written code), it will proactively offer refactoring suggestions. For example:
    - "This AI-generated function has a high cyclomatic complexity. Consider extracting it into three smaller functions."
    - "I've noticed your team prefers a functional programming style. This imperative loop generated by the AI could be refactored into a `.map().filter()` chain."
    - "The variable name `temp_data` is unclear. Based on the context, I suggest renaming it to `userProfile`."

This adaptive user modeling capability will elevate AetherScript beyond a simple code generator, transforming it into a **self-optimizing** development environment that can understand and adapt to the unique coding culture of specific projects and teams. It will evolve from a "generator of code" to a "guardian of code quality."

### **8.2 Towards Formal Verification: Generating TLA+ Specifications from AetherScript**

The most expensive errors in software development often stem from flaws in system design and concurrency logic, not simple implementation bugs. Formal methods, like TLA+, provide a powerful tool for mathematically proving the correctness of a system's design before coding begins. However, learning and writing TLA+ specifications has a high barrier to entry.

AetherScript's unique architecture of **separating intent from implementation** offers an unprecedented opportunity to bridge the gap between high-level software design and low-level formal verification.

**Core Idea:** The `.as` file is essentially a high-level, semi-formal specification of the system's behavior. It defines the components, their methods (operations), and the data flow between them, while stripping away the "noisy" implementation details. This makes the `.as` file an ideal input for generating formal specifications like TLA+.

**Envisioned Workflow:**

1. **Input:**
    - A complete `.as` file describing the system's state variables (class properties) and operations (methods).
    - Natural language descriptions of invariants and temporal properties written by the developer in JSDoc within the `.as` file. For example, a comment in a bank transfer method might state: "The system must guarantee that the total amount of money across all accounts remains constant at all times."
2. **LLM as a Specification Translator:** A new `aesc` command, such as `aesc spec-gen`, would invoke a specially trained LLM. This LLM's task is not to generate code, but to **translate the `.as` file and JSDoc comments into a TLA+ specification**.
    - Class properties are mapped to TLA+ `VARIABLES`.
    - Class methods are mapped to TLA+ `actions`.
    - Invariant descriptions in JSDoc are translated into TLA+ `invariants`.
3. **Model Checking:** The developer can use the TLA+ toolbox (like the TLC model checker) to check the generated specification for logical flaws in the design, such as race conditions or deadlocks.
4. **Iteration and Correction:** If a problem is found during model checking, the developer can correct the design in the `.as` file or the description in the JSDoc, then regenerate and re-verify the TLA+ specification.

**Significance:** This workflow **combines the natural language processing capabilities of LLMs with the rigor of formal methods**. It allows developers to enjoy the benefits of formal verification without having to write complex TLA+ code directly. After the system's high-level design has been proven correct, developers can confidently use AetherScript's regular features to generate the concrete implementation code. This represents a clear path towards **"Verifiable AI-Assisted Software Engineering"** and is one of AetherScript's most disruptive long-term visions.

### **8.3 Conclusion: AetherScript as a Next-Generation Development Platform**

AetherScript is more than just a tool; it proposes a new philosophy for software development. By clearly distinguishing between **human core responsibilities (design, defining contracts, reviewing) and AI's auxiliary role (implementing, following patterns, handling details)**, it establishes a structured and trustworthy framework for collaboration between developers and AI.

- Through the **"Acceptance Model" and the `.asc` staging area**, AetherScript addresses the issues of trust and controllability in AI code generation.
- Through **type contracts and compiler-level validation**, it ensures that the AI's output strictly adheres to the architectural constraints set by humans.
- Through **deep integration with Bun and VS Code**, it provides a seamless and efficient modern development experience, making the complex underlying mechanisms transparent to the user.
- Through its planning for **advanced concepts like proactive refactoring and formal verification**, it demonstrates the immense potential to evolve from a development tool into a comprehensive, intelligent software engineering platform.

AetherScript aims to lead software development into a new era. In this era, developers are no longer the sole writers of code but are the **chief architects** of systems and the **commanders** of AI assistants. By separating creative design work from automated implementation details, AetherScript promises to dramatically increase development efficiency, improve code quality, and ultimately enable developers to focus on building more complex, more reliable, and more valuable software systems. This is not just an optimization of current work methods, but a profound reshaping of the future of software development.

### **Works Cited**

1. OWASP LLM Top 10: How it Applies to Code Generation | Learn Article - Sonar, [https://www.sonarsource.com/learn/owasp-llm-code-generation/](https://www.sonarsource.com/learn/owasp-llm-code-generation/) 2. MetaGPT: An Interesting Approach to Multi-Agent Collaboration | by Gary Nakanelua | GTA: Generative Tech Advances | Medium, [https://medium.com/gta-generative-tech-advances/metagpt-an-interesting-approach-to-multi-agent-collaboration-5ace263c4fd8](https://medium.com/gta-generative-tech-advances/metagpt-an-interesting-approach-to-multi-agent-collaboration-5ace263c4fd8) 3. oven-sh/bun: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one - GitHub, [https://github.com/oven-sh/bun](https://github.com/oven-sh/bun) 4. Getting Started with Bun API - Apidog, [https://apidog.com/blog/bun-api](https://apidog.com/blog/bun-api) 5. Abstract Syntax Tree In TypeScript - DEV Community, [https://dev.to/bilelsalemdev/abstract-syntax-tree-in-typescript-25ap](https://dev.to/bilelsalemdev/abstract-syntax-tree-in-typescript-25ap) 6. typescript vs ts-node vs ts-loader vs ts-morph vs tslint - NPM Compare, [https://npm-compare.com/ts-loader,ts-morph,ts-node,tslint,typescript](https://npm-compare.com/ts-loader,ts-morph,ts-node,tslint,typescript) 7. Generating Typescript using AST's - Nabeel Valley, [https://nabeelvalley.co.za/docs/javascript/typescript-ast/](https://nabeelvalley.co.za/docs/javascript/typescript-ast/) 8. How can I parse, modify, and regenerate the AST of a TypeScript file (like jscodeshift)?, [https://stackoverflow.com/questions/45466913/how-can-i-parse-modify-and-regenerate-the-ast-of-a-typescript-file-like-jscod](https://stackoverflow.com/questions/45466913/how-can-i-parse-modify-and-regenerate-the-ast-of-a-typescript-file-like-jscod) 9. Functions - ts-morph, [https://ts-morph.com/details/functions](https://ts-morph.com/details/functions) 10. Imports - ts-morph, [https://ts-morph.com/details/imports](https://ts-morph.com/details/imports) 11. Manipulating Source Files - ts-morph, [https://ts-morph.com/manipulation/](https://ts-morph.com/manipulation/) 12. AST-based refactoring with ts-morph - kimmo.blog, [https://kimmo.blog/posts/8-ast-based-refactoring-with-ts-morph/](https://kimmo.blog/posts/8-ast-based-refactoring-with-ts-morph/) 13. TypeScript AST Viewer, [https://ts-ast-viewer.com/](https://ts-ast-viewer.com/) 14. developer.chrome.com, [https://developer.chrome.com/blog/sourcemaps#:~:text=Source%20maps%20are%20a%20way,information%20about%20your%20original%20files](https://developer.chrome.com/blog/sourcemaps#:~:text=Source%20maps%20are%20a%20way,information%20about%20your%20original%20files). 15. Introduction to JavaScript Source Maps | Blog - Chrome for Developers, [https://developer.chrome.com/blog/sourcemaps](https://developer.chrome.com/blog/sourcemaps) 16. Map the processed code to your original source code, for debugging - Microsoft Edge Developer documentation, [https://learn.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/javascript/source-maps](https://learn.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/javascript/source-maps) 17. Use a source map — Firefox Source Docs documentation - Mozilla, [https://firefox-source-docs.mozilla.org/devtools-user/debugger/how_to/use_a_source_map/index.html](https://firefox-source-docs.mozilla.org/devtools-user/debugger/how_to/use_a_source_map/index.html) 18. Specification for the Content Source Maps standard. Used to power Visual Editing experiences. - GitHub, [https://github.com/sanity-io/content-source-maps](https://github.com/sanity-io/content-source-maps) 19. Source map format specification - TC39, [https://tc39.es/source-map/](https://tc39.es/source-map/) 20. source-map-rev3.md - GitHub, [https://github.com/tc39/source-map-spec/blob/main/source-map-rev3.md](https://github.com/tc39/source-map-spec/blob/main/source-map-rev3.md) 21. [2502.06039] Benchmarking Prompt Engineering Techniques for Secure Code Generation with GPT Models - arXiv, [https://arxiv.org/abs/2502.06039](https://arxiv.org/abs/2502.06039) 22. [2412.20545] The Impact of Prompt Programming on Function-Level Code Generation, [https://arxiv.org/abs/2412.20545](https://arxiv.org/abs/2412.20545) 23. How to write good prompts for generating code from LLMs - GitHub, [https://github.com/potpie-ai/potpie/wiki/How-to-write-good-prompts-for-generating-code-from-LLMs](https://github.com/potpie-ai/potpie/wiki/How-to-write-good-prompts-for-generating-code-from-LLMs) 24. How I Code With LLMs These Days - Honeycomb, [https://www.honeycomb.io/blog/how-i-code-with-llms-these-days](https://www.honeycomb.io/blog/how-i-code-with-llms-these-days) 25. Selection of Prompt Engineering Techniques for Code Generation through Predicting Code Complexity - arXiv, [https://arxiv.org/pdf/2409.16416](https://arxiv.org/pdf/2409.16416) 26. Node.js API - ESLint - Pluggable JavaScript linter - GitHub Pages, [https://denar90.github.io/eslint.github.io/docs/developer-guide/nodejs-api](https://denar90.github.io/eslint.github.io/docs/developer-guide/nodejs-api) 27. Node.js API Reference - ESLint - Pluggable JavaScript Linter, [https://eslint.org/docs/latest/integrate/nodejs-api](https://eslint.org/docs/latest/integrate/nodejs-api) 28. What is MetaGPT ? | IBM, [https://www.ibm.com/think/topics/metagpt](https://www.ibm.com/think/topics/metagpt) 29. MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework - OpenReview, [https://openreview.net/forum?id=VtmBAGCN7o](https://openreview.net/forum?id=VtmBAGCN7o) 30. MetaGPT Vs AutoGen: A Comprehensive Comparison - SmythOS, [https://smythos.com/developers/agent-comparisons/metagpt-vs-autogen/](https://smythos.com/developers/agent-comparisons/metagpt-vs-autogen/) 31. FoundationAgents/MetaGPT: The Multi-Agent Framework: First AI Software Company, Towards Natural Language Programming - GitHub, [https://github.com/FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) 32. MetaGPT: The Multi-Agent Framework, [https://docs.deepwisdom.ai/main/en/guide/get_started/introduction.html](https://docs.deepwisdom.ai/main/en/guide/get_started/introduction.html) 33. Building CLI Applications Made Easy with These NodeJS Frameworks | by Ibrahim Haouari, [https://ibrahim-haouari.medium.com/building-cli-applications-made-easy-with-these-nodejs-frameworks-2c06d1ff7a51](https://ibrahim-haouari.medium.com/building-cli-applications-made-easy-with-these-nodejs-frameworks-2c06d1ff7a51) 34. commander vs yargs vs oclif vs vorpal | Node.js Command-Line Interface Libraries Comparison - NPM Compare, [https://npm-compare.com/commander,oclif,vorpal,yargs](https://npm-compare.com/commander,oclif,vorpal,yargs) 35. Commander.js vs other CLI frameworks - StudyRaid, [https://app.studyraid.com/en/read/11908/379336/commanderjs-vs-other-cli-frameworks](https://app.studyraid.com/en/read/11908/379336/commanderjs-vs-other-cli-frameworks) 36. Comparing prompt libraries: Commander vs Yargs - StudyRaid, [https://app.studyraid.com/en/read/15422/535545/comparing-prompt-libraries-commander-vs-yargs](https://app.studyraid.com/en/read/15422/535545/comparing-prompt-libraries-commander-vs-yargs) 37. node js typescript cli framework - Reddit, [https://www.reddit.com/r/node/comments/mxq9gi/node_js_typescript_cli_framework/](https://www.reddit.com/r/node/comments/mxq9gi/node_js_typescript_cli_framework/) 38. oclif: The Open CLI Framework, [https://oclif.io/](https://oclif.io/) 39. shadawck/awesome-cli-frameworks: Collection of tools to build beautiful command line interface in different languages - GitHub, [https://github.com/shadawck/awesome-cli-frameworks](https://github.com/shadawck/awesome-cli-frameworks) 40. The largest Node.js CLI Apps best practices list - GitHub, [https://github.com/lirantal/nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) 41. Plugins – Bundler | Bun Docs, [https://bun.sh/docs/bundler/plugins](https://bun.sh/docs/bundler/plugins) 42. bun/docs/runtime/plugins.md at main · oven-sh/bun - GitHub, [https://github.com/oven-sh/bun/blob/main/docs/runtime/plugins.md?plain=1](https://github.com/oven-sh/bun/blob/main/docs/runtime/plugins.md?plain=1) 43. Watch mode – Runtime | Bun Docs, [https://bun.sh/docs/runtime/hot](https://bun.sh/docs/runtime/hot) 44. Hot reloading – Bundler | Bun Docs, [https://bun.sh/docs/bundler/hmr](https://bun.sh/docs/bundler/hmr) 45. Plugin API to map virtual modules to files on disk for HMR · Issue #15860 · vitejs/vite · GitHub, [https://github.com/vitejs/vite/issues/15860](https://github.com/vitejs/vite/issues/15860) 46. Adding a Language Server Protocol extension - Visual Studio (Windows) | Microsoft Learn, [https://learn.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension?view=vs-2022](https://learn.microsoft.com/en-us/visualstudio/extensibility/adding-an-lsp-extension?view=vs-2022) 47. Quick Start to VSCode Plug-Ins: Language Server Protocol (LSP) - Alibaba Cloud, [https://www.alibabacloud.com/blog/595294](https://www.alibabacloud.com/blog/595294) 48. Language Server Protocol Specification - 3.17 - Microsoft Open Source, [https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/) 49. Extensions using CodeLens - Visual Studio Code, [https://code.visualstudio.com/blogs/2017/02/12/code-lens-roundup](https://code.visualstudio.com/blogs/2017/02/12/code-lens-roundup) 50. Visual Studio Code (VS-Code) References & Implementations CodeLens | by A Developer, [https://ash12rai-weblearning.medium.com/visual-studio-code-vs-code-references-implementations-codelens-8a6f88ceb786](https://ash12rai-weblearning.medium.com/visual-studio-code-vs-code-references-implementations-codelens-8a6f88ceb786) 51. Understanding CodeLens in VSCode: How to Enable and Utilize Code References | TikTok, [https://www.tiktok.com/@vscode/video/7418280242202152234](https://www.tiktok.com/@vscode/video/7418280242202152234) 52. Using Git source control in VS Code, [https://code.visualstudio.com/docs/sourcecontrol/overview](https://code.visualstudio.com/docs/sourcecontrol/overview) 53. User interface - Visual Studio Code, [https://code.visualstudio.com/docs/getstarted/userinterface](https://code.visualstudio.com/docs/getstarted/userinterface) 54. caponetto/vscode-diff-viewer: A simple VS Code extension to easily visualize git diff files., [https://github.com/caponetto/vscode-diff-viewer](https://github.com/caponetto/vscode-diff-viewer) 55. How can I see 'git diff' on the Visual Studio Code side-by-side file? - Stack Overflow, [https://stackoverflow.com/questions/51316233/how-can-i-see-git-diff-on-the-visual-studio-code-side-by-side-file](https://stackoverflow.com/questions/51316233/how-can-i-see-git-diff-on-the-visual-studio-code-side-by-side-file) 56. AI Code Refactoring: Boost Your Code Quality Fast | DocuWriter.ai, [https://www.docuwriter.ai/posts/ai-code-refactoring](https://www.docuwriter.ai/posts/ai-code-refactoring) 57. Autonomous Code Refactoring: The Future of Software Maintainability - TechWize, [https://techwize.com/blog-details/autonomous-code-refactoring-the-future-of-software-maintainability](https://techwize.com/blog-details/autonomous-code-refactoring-the-future-of-software-maintainability) 58. Simplifying Refactoring for Large Codebases with AI - Zencoder, [https://zencoder.ai/blog/simplifying-refactoring-for-large-codebases-with-ai](https://zencoder.ai/blog/simplifying-refactoring-for-large-codebases-with-ai) 59. A Feasibility of On-Device ML for Adaptive User Interfaces in Frontend Development - DevConf.CZ 2025 - YouTube, [https://www.youtube.com/watch?v=wekOVpSPF4c](https://www.youtube.com/watch?v=wekOVpSPF4c) 60. Top Code Refactoring Tools for Efficient Development in 2025 | DocuWriter.ai, [https://www.docuwriter.ai/posts/code-refactoring-tools](https://www.docuwriter.ai/posts/code-refactoring-tools) 61. Code Smarter, Not Harder: Using AI for Refactoring and Optimization - GoCodeo, [https://www.gocodeo.com/post/code-smarter-not-harder-using-ai-for-refactoring-and-optimization](https://www.gocodeo.com/post/code-smarter-not-harder-using-ai-for-refactoring-and-optimization) 62. GenAI-Accelerated TLA+ Challenge - Hacker News, [https://news.ycombinator.com/item?id=43907850](https://news.ycombinator.com/item?id=43907850) 63. Combining LLM Code Generation with Formal Specifications and Reactive Program Synthesis - arXiv, [https://arxiv.org/html/2410.19736v1](https://arxiv.org/html/2410.19736v1) 64. [2501.03073] Retrieval-Augmented TLAPS Proof Generation with Large Language Models, [https://arxiv.org/abs/2501.03073](https://arxiv.org/abs/2501.03073) 65. Towards Large Language Models as Copilots for Theorem Proving in Lean - Math-AI, [https://mathai2023.github.io/papers/4.pdf](https://mathai2023.github.io/papers/4.pdf) 66. Towards Large Language Models as Copilots for Theorem Proving in Lean - arXiv, [https://arxiv.org/html/2404.12534v1](https://arxiv.org/html/2404.12534v1)
