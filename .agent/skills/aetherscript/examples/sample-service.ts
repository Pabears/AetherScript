/**
 * Example: IDE-Friendly Abstract Service Pattern
 * 
 * This file demonstrates how to write an abstract class that:
 * 1. Uses // @autogen comment to trigger code generation
 * 2. Has NO red squiggles in your IDE
 * 3. Uses standard TypeScript features
 */

// @autogen
export abstract class ExampleService {
    /**
     * Dependencies are marked with @AutoGen comment.
     * Using `?` makes them optional, avoiding "not initialized" errors.
     */
    // @AutoGen
    public db?: Database;

    /**
     * Abstract methods have NO body.
     * TypeScript allows this with the `abstract` keyword.
     * 
     * Add comments to guide the AI implementation:
     * 1. Validate input
     * 2. Call db.save()
     * 3. Return the saved entity
     */
    public abstract createItem(name: string, value: number): Item;

    /**
     * Return type can be union with undefined for nullable results.
     */
    public abstract findById(id: string): Item | undefined;

    /**
     * Async methods work too.
     */
    public abstract fetchAll(): Promise<Item[]>;
}

// Supporting types (these would normally be in separate files)
interface Database {
    save(obj: any): void;
    find(id: string): any;
    getAll(): any[];
}

interface Item {
    id: string;
    name: string;
    value: number;
}
