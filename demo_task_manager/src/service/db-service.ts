// @autogen
export abstract class DBService {
    // Generate an ID for a new object
    public abstract generateId(): string;

    // Save an object to a specific collection (e.g. 'users', 'projects', 'tasks') 
    // Return true if saved successfully
    public abstract saveObject(collection: string, obj: any): Promise<boolean>;

    // Find a specific object by its ID within a collection
    public abstract findObjectById(collection: string, id: string): Promise<any | undefined>;

    // Find all objects in a collection matching a specific field/value pair
    public abstract findObjectsByField(collection: string, field: string, value: any): Promise<any[]>;

    // Get all objects inside a collection
    public abstract getAllObjects(collection: string): Promise<any[]>;

    // Delete an object from a collection
    public abstract deleteObject(collection: string, id: string): Promise<boolean>;
}
