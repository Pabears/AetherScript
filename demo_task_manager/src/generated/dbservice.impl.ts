// Generated from /Users/shiheng/myproject/AetherScript/demo_task_manager/src/service/db-service.ts
import { DBService } from '../service/db-service';
import { randomUUID } from 'crypto';

export class DBServiceImpl extends DBService {
    private storage: Map<string, Map<string, any>> = new Map();

    /**
     * Generate a unique ID using crypto.randomUUID
     */
    public generateId(): string {
        return randomUUID();
    }

    /**
     * Save an object to a specific collection.
     * Uses the 'id' property of the object as the key.
     */
    public async saveObject(collection: string, obj: any): Promise<boolean> {
        if (!this.storage.has(collection)) {
            this.storage.set(collection, new Map());
        }
        
        const coll = this.storage.get(collection)!;
        const id = obj.id;
        
        if (!id) {
            return false;
        }

        coll.set(id, { ...obj });
        return true;
    }

    /**
     * Find a specific object by its ID within a collection.
     */
    public async findObjectById(collection: string, id: string): Promise<any | undefined> {
        const coll = this.storage.get(collection);
        if (!coll) return undefined;
        
        const obj = coll.get(id);
        return obj ? { ...obj } : undefined;
    }

    /**
     * Find all objects in a collection matching a specific field/value pair.
     */
    public async findObjectsByField(collection: string, field: string, value: any): Promise<any[]> {
        const coll = this.storage.get(collection);
        if (!coll) return [];

        return Array.from(coll.values())
            .filter(obj => obj[field] === value)
            .map(obj => ({ ...obj }));
    }

    /**
     * Get all objects inside a collection.
     */
    public async getAllObjects(collection: string): Promise<any[]> {
        const coll = this.storage.get(collection);
        if (!coll) return [];

        return Array.from(coll.values()).map(obj => ({ ...obj }));
    }

    /**
     * Delete an object from a collection by its ID.
     */
    public async deleteObject(collection: string, id: string): Promise<boolean> {
        const coll = this.storage.get(collection);
        if (!coll) return false;

        return coll.delete(id);
    }
}