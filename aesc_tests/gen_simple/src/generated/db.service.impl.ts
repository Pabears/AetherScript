import { DB } from "../db-service";
import { User } from "../user";

export class DBImpl extends DB {
    private users: User[] = [];

    save(user: User): void {
        if (typeof user.name !== 'string' || user.name.trim() === '') {
            throw new Error('Invalid user name');
        }
        if (typeof user.age !== 'number' || user.age <= 0) {
            throw new Error('Invalid user age');
        }
        this.users.push(user);
    }

    find(name: string): User | undefined {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('Invalid name');
        }
        return this.users.find(user => user.name === name);
    }
}