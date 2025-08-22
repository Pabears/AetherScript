import { DB } from "../db-service";
import { User } from "../user";
import NodeCache from "node-cache";

export class DBImpl extends DB {
    public save(user: User): void {
        this.cache.set(user.name, user);
    }
    
    public find(name: string): User | undefined {
        return this.cache.get(name);
    }
    
    public saveObject(key: string, data: any): void {
        this.cache.set(key, data);
    }
    
    public findObject(key: string): any {
        return this.cache.get(key);
    }
    
    public getAllKeys(): string[] {
        return this.cache.keys();
    }
    
    public deleteObject(key: string): boolean {
        return this.cache.del(key) > 0;
    }
}