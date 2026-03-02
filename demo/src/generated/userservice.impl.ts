// Generated from src/service/user-service.ts
import { User } from "../entity/user";
import { UserService } from '../service/user-service';
import { DB } from "../service/db-service";

export class UserServiceImpl extends UserService {
    /**
     * Create a new user after validation
     * 1. check: 3 < name.length < 15 and 0 <= age <= 120
     * 2. db.save(user)
     */
    public create(user: User): void {
        // Validation check: 3 < name.length < 15 and 0 <= age <= 120
        if (user.name.length > 3 && user.name.length < 15 && user.age >= 0 && user.age <= 120) {
            if (this.db) {
                this.db.save(user);
            }
        } else {
            throw new Error(`Invalid user data: Name length must be between 3 and 15 (exclusive), and age must be between 0 and 120 (inclusive). Received name: '${user.name}', age: ${user.age}.`);
        }
    }

    /**
     * Find user by name from the database
     */
    public findByName(name: string): User | undefined {
        if (!this.db) {
            return undefined;
        }

        // Get all users from the DB and find the one with the matching name
        const allUsers = this.db.getAll() as User[];
        return allUsers.find(u => u && u.name === name);
    }
}