import { DB } from "../service/db-service";
import { User } from "../entity/user";
import NodeCache from "node-cache";

export class DBImpl extends DB {
    // save user to cache
    public save(user: User): void {
        if (!user.name || typeof user.name !== 'string' || user.age <= 0 || typeof user.age !== 'number') {
            throw new Error('Invalid user data');
        }
        this.cache.set(user.name, user);
    }

    // find user from cache
    public find(name: string): User | undefined {
        if (typeof name !== 'string' || name.trim().length === 0) {
            throw new Error('Invalid name');
        }
        return this.cache.get(name) as User | undefined;
    }

    // save any object to cache with key
    public saveObject(key: string, data: any): void {
        if (typeof key !== 'string' || key.trim().length === 0) {
            throw new Error('Invalid key');
        }
        this.cache.set(key, data);
    }

    // find any object from cache by key
    public findObject(key: string): any {
        if (typeof key !== 'string' || key.trim().length === 0) {
            throw new Error('Invalid key');
        }
        return this.cache.get(key);
    }

    // get all keys from cache
    public getAllKeys(): string[] {
        return this.cache.keys();
    }

    // delete object from cache
    public deleteObject(key: string): boolean {
        if (typeof key !== 'string' || key.trim().length === 0) {
            throw new Error('Invalid key');
        }
        return this.cache.del(key) > 0;
    }
}