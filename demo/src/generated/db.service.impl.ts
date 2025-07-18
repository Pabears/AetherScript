import { DB } from "../service/db-service";
import { User } from "../entity/user";
import NodeCache from "node-cache";

export class DBImpl extends DB {
    public save(user: User): void {
        if (typeof user.name !== 'string' || typeof user.age !== 'number') {
            throw new Error('Invalid user data');
        }
        this.cache.set(user.name, user);
    }

    public find(name: string): User | undefined {
        if (typeof name !== 'string') {
            throw new Error('Invalid name');
        }
        return this.cache.get(name) as User;
    }

    public saveObject(key: string, data: any): void {
        if (typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        this.cache.set(key, data);
    }

    public findObject(key: string): any {
        if (typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.cache.get(key);
    }

    public getAllKeys(): string[] {
        return this.cache.keys();
    }

    public deleteObject(key: string): boolean {
        if (typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.cache.del(key) > 0;
    }
}