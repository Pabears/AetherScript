// Generated from src/db-service.ts
import { User } from "../user";
import { DB } from "../db-service";

/**
 * Concrete implementation of the DB service using NodeCache.
 */
export class DBImpl extends DB {
    /**
     * Saves a user to the cache using their name as the key.
     * @param user The user object to save.
     */
    public save(user: User): void {
        this.cache.set(user.name, user);
    }

    /**
     * Finds a user in the cache by their name.
     * @param name The name of the user to find.
     * @returns The User object if found, otherwise undefined.
     */
    public find(name: string): User | undefined {
        return this.cache.get<User>(name);
    }

    /**
     * Saves any object to the cache with a specified key.
     * @param key The key to store the data under.
     * @param data The data to be stored.
     */
    public saveObject(key: string, data: any): void {
        this.cache.set(key, data);
    }

    /**
     * Finds any object from the cache by its key.
     * @param key The key of the object to retrieve.
     * @returns The stored object, or undefined if not found.
     */
    public findObject(key: string): any {
        return this.cache.get(key);
    }

    /**
     * Retrieves all keys currently stored in the cache.
     * @returns An array of string keys.
     */
    public getAllKeys(): string[] {
        return this.cache.keys();
    }

    /**
     * Deletes an object from the cache by its key.
     * @param key The key of the object to delete.
     * @returns True if the key was found and deleted, false otherwise.
     */
    public deleteObject(key: string): boolean {
        const deletedCount = this.cache.del(key);
        return deletedCount > 0;
    }
}