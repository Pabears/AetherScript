import { DB } from '../service/db-service';
import { User } from '../entity/user';

export class DBImpl extends DB {
    private store: Map<string, any> = new Map();

    public save(user: User): void {
        this.store.set(user.name, user);
    }

    public find(name: string): User | undefined {
        return this.store.get(name);
    }

    public saveObject(key: string, data: any): void {
        this.store.set(key, data);
    }

    public findObject(key: string): any {
        return this.store.get(key);
    }

    public getAllKeys(): string[] {
        return [...this.store.keys()];
    }

    public deleteObject(key: string): boolean {
        return this.store.delete(key);
    }
}
// modified
// modified
