import { DB } from "../db-service";
import { User } from "../user";

export class DBImpl extends DB {
    private users: User[] = [];

    save(user: User): void {
        if (user.name.length === 0 || user.age < 0) {
            throw new Error("Invalid user data");
        }
        this.users.push(user);
    }

    find(name: string): User | undefined {
        return this.users.find(u => u.name === name);
    }
}