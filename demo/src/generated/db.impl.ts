// Generated from src/service/db-service.ts
import { DB } from '../service/db-service';
import NodeCache from "node-cache";

export class DBImpl extends DB {
    /**
     * Fallback/Legacy reference for saving an object.
     * Delegates to saveObject.
     */
    public override save(obj: any): void {
        this.saveObject(obj);
    }

    /**
     * Fallback/Legacy reference for finding an object.
     * Delegates to findObject.
     */
    public override find(id: string): any | undefined {
        return this.findObject(id);
    }

    /**
     * Save any object to cache using obj.id as the key.
     */
    public override saveObject(obj: any): void {
        if (obj && obj.id) {
            this.cache.set(obj.id, obj);
        }
    }

    /**
     * Find any object from cache by its id string.
     */
    public override findObject(id: string): any | undefined {
        return this.cache.get(id);
    }

    /**
     * Get all objects currently stored in the cache.
     */
    public override getAllObjects(): any[] {
        const keys = this.cache.keys();
        return keys.map(key => this.cache.get(key));
    }

    /**
     * Alias for getAllObjects.
     */
    public override getAll(): any[] {
        return this.getAllObjects();
    }

    /**
     * Alias for getAllObjects.
     */
    public override findAll(): any[] {
        return this.getAllObjects();
    }

    /**
     * Delete object from cache by id.
     * Returns true if the object existed and was deleted.
     */
    public override deleteObject(id: string): boolean {
        const deletedCount = this.cache.del(id);
        return deletedCount > 0;
    }
}