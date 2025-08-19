import { UserService } from "../user-service";
import { DB } from "../db-service";
import { User } from "../user";
import { AutoGen } from "aesc";

export class UserServiceImpl extends UserService {
    create(user: User): void {
        if (!user.name || typeof user.name !== 'string' || user.name.trim().length === 0) {
            throw new Error('Invalid name');
        }
        if (typeof user.age !== 'number' || user.age <= 0) {
            throw new Error('Invalid age');
        }
        this.db?.save(user);
    }

    findByName(name: string): User | undefined {
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw new Error('Invalid name');
        }
        return this.db?.find(name);
    }
}