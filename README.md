# AetherScript: AI-Assisted Development You Can Trust

AetherScript is a powerful **AI-powered code generation framework** that redefines human-AI collaboration in software development. By acting as an extension to AI coding tools (like Gemini CLI or Claude Code), it automates the implementation of well-defined interfaces, ensuring the developer always remains in full control.

## Core Philosophy: Define Interfaces, Not Implementations

The central idea behind AetherScript is to **separate human intent from AI implementation**. The developer focuses on WHAT the code should do (interface design), and the AI handles HOW to do it (implementation).

1.  **The Human Defines the Architecture**: As a developer, you define the "what" and the "how" of your application's architecture. You create abstract classes, defining the contracts and boundaries of your system. You add JSDoc comments to outline the desired logic.
2.  **Marking for Generation**: You use the `// @autogen` comment above a class to mark it for AI implementation. 
3.  **Dependency Injection**: You use the `@AutoGen` decorator on properties to indicate dependencies that should be automatically injected by the generated container.
4.  **The Developer Stays in Control**: The AI-generated code is never injected directly into your source files. It is placed in a separate, dedicated `generated` directory (e.g., `src/generated`). You, the developer, explicitly import and use the generated code, giving you the final say on what gets included in your application.

This approach provides the best of both worlds: the creative, high-level architectural control of a human developer, combined with the speed and efficiency of an AI that handles the tedious implementation details.

## Example Workflow

### Step 1: Define Abstract Classes

Create abstract classes marked with `// @autogen`:

```typescript
// @autogen
export abstract class OrderService {
    // @AutoGen - dependency injection marker
    public db?: DB;
    public notificationService?: NotificationService;

    // Abstract methods - describe WHAT, not HOW
    // Comments guide the AI implementation
    /**
     * Create a new order
     * 1. Validate customer exists
     * 2. Check product inventory
     * 3. Calculate total with discounts
     * 4. Save to database
     * 5. Send confirmation notification
     */
    public abstract createOrder(customerId: string, items: OrderItem[]): Promise<Order>;
}
```

### Step 2: Generate Implementations

Use the AetherScript extension command in your AI CLI (e.g., Gemini CLI):

```bash
/aesc-gen
```

This generates:
*   Concrete implementations in `src/generated/{service}.impl.ts`.
*   A dependency injection container in `src/generated/container.ts`.

### Step 3: Generate Tests

You can also automatically generate unit tests for these implementations:

```bash
/aesc-test
```

This generates unit tests for each service in your `test/` directory.

## Best Practices for Interface Design

When designing interfaces for AetherScript:

1.  **Keep methods focused**: One responsibility per method.
2.  **Use descriptive names**: `createOrder` instead of just `create`.
3.  **Add JSDoc comments**: Clearly describe the logic flow to guide the AI implementation.
4.  **Define dependencies**: Use `@AutoGen` for properties that need dependency injection.
5.  **Use proper types**: Avoid `any`, and clearly define your entities.

## Reliability and Trust

AetherScript's structured approach dramatically improves the effective reliability of LLMs. By providing the AI with rigid boundaries (abstract classes) and clear, step-by-step logic constraints (JSDoc), you eliminate the unpredictable "hallucinations" of free-form code generation. 

During code review, you only need to focus on:
*   ✅ Abstract class interfaces (contracts)
*   ✅ Method signatures and parameters
*   ✅ JSDoc comment logic descriptions

You no longer need to scrutinize the boilerplate implementation details, trusting the deterministic generation process.
