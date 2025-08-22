import { DB } from "../db-service";
import { User } from "../user";
import NodeCache from "node-cache";

export class DBImpl extends DB {
    // save user to cache
    public save(user: User): void {
        this.cache.set(user.name, user);
    }
    
    // find user from cache
    public find(name: string): User | undefined {
        return this.cache.get(name);
    }
    
    // save any object to cache with key
    public saveObject(key: string, data: any): void {
        this.cache.set(key, data);
    }
    
    // find any object from cache by key
    public findObject(key: string): any {
        return this.cache.get(key);
    }
    
    // get all keys from cache
    public getAllKeys(): string[] {
        return this.cache.keys();
    }
    
    // delete object from cache
    public deleteObject(key: string): boolean {
        return this.cache.del(key) > 0;
    }
}