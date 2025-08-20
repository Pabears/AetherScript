import { DB } from "../db-service";
import { User } from "../user";
import NodeCache from "node-cache";

export class DBImpl extends DB {
    constructor() {
        super();
        this.cache = new NodeCache({ stdTTL: 0 });
    }

    public save(user: User): void {
        this.cache.set(`user-${user.name}`, user);
    }

    public find(name: string): User | undefined {
        return this.cache.get(`user-${name}`);
    }

    public saveObject(key: string, data: any): void {
        this.cache.set(key, data);
    }

    public findObject(key: string): any {
        return this.cache.get(key);
    }

    public getAllKeys(): string[] {
        return Object.keys(this.cache.data);
    }

    public deleteObject(key: string): boolean {
        if (this.cache.has(key)) {
            this.cache.del(key);
            return true;
        }
        return false;
    }
}