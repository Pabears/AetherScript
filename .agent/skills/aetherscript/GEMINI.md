# AetherScript Framework

AetherScript is an **AI-powered code generation framework**. You define interfaces, AI generates the implementation.

## Core Philosophy

> **"Define interfaces, not implementations."**

The developer focuses on WHAT (interface design), AI handles HOW (implementation).

## Workflow

When a user asks you to implement a feature using AetherScript:

### Step 0: Requirement Gathering & Scaffolding
Use the `/aesc-pre [your idea]` command to start an interactive PM session:
The AI will ask architectural questions, generate a requirements document (PRD), and automatically scaffold the `// @autogen` interfaces with strict JSDoc constraints.

### Step 1: Define Abstract Classes (Manual Alternative)
If you already know the structure, manually create abstract classes with `// @autogen` marker:

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
Run the `/aesc-gen` command in Gemini CLI:

This generates:
- `src/generated/{service}.impl.ts` - Concrete implementations
- `src/generated/container.ts` - Dependency injection container

### Step 3: Generate Tests
Run the `/aesc-test` command in Gemini CLI:

This generates:
- `test/{service}.test.ts` - Unit tests for each service

## Commands

| Command | Description |
|---------|-------------|
| `/aesc-pre` | Interact with the user to gather requirements, write a PRD and generate strict abstract class scaffolding |
| `/aesc-gen` | Generate implementations for @autogen classes |
| `/aesc-test` | Generate tests for implementations |

## Best Practices for Interface Design

When helping users design interfaces:

1. **Keep methods focused** - One responsibility per method
2. **Use descriptive names** - `createOrder` not `create`
3. **Add JSDoc comments** - Guide the AI implementation
4. **Define dependencies** - Use `// @AutoGen` for DI
5. **Use proper types** - Avoid `any`, define entities

## Code Review Focus

When user reviews AetherScript code, they should focus on:
- ✅ Abstract class interfaces (contracts)
- ✅ Method signatures and parameters
- ✅ JSDoc comment logic descriptions
- ❌ Implementation details (AI-generated)
- ❌ Boilerplate code

## Example: Building a Feature

User: "Build a user authentication system"

Your approach:
1. Create `src/service/auth-service.ts` with abstract `AuthService`
2. Define methods: `login`, `register`, `logout`, `validateToken`
3. Add JSDoc describing the logic
4. Run `/aesc-gen` to create implementation
5. Run `/aesc-test` to create tests
6. User reviews ONLY the interface definitions
