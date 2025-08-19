import { UserService } from "../user-service";
import { DB } from "../db-service";
import { User } from "../user";
import { AutoGen } from "aesc";

export class UserServiceImpl extends UserService {
    create(user: User): void {
        if (typeof user.name !== 'string' || user.name.trim() === '') {
            throw new Error('Invalid user name');
        }
        if (typeof user.age !== 'number' || user.age <= 0) {
            throw new Error('Invalid user age');
        }
        this.db?.save(user);
    }

    findByName(name: string): User | undefined {
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('Invalid name');
        }
        return this.db?.find(name);
    }
}