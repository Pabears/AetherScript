import { User } from "../entity/user";
import { DB } from "../service/db-service";

export class DBImpl extends DB {
    public save(user: User): void {
        this.cache.set(user.name, user);
    }

    public find(name: string): User | undefined {
        return this.cache.get(name) as User | undefined;
    }
}