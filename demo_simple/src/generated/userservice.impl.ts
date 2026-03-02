// Generated from src/user-service.ts
import { User } from "../user";
import { DB } from "../db-service";
import { UserService } from "../user-service";

export class UserServiceImpl extends UserService {
    /**
     * Create a new user with validation
     * 1. check: 3 < name.length < 15 and 0 <= age <= 120
     * 2. check: if user already exists (by name), throw an error "User already exists"
     * 3. db.save(user)
     */
    public create(user: User): void {
        if (user.name.length <= 3 || user.name.length >= 15) {
            throw new Error("Validation failed: name length must be between 3 and 15");
        }
        if (user.age < 0 || user.age > 120) {
            throw new Error("Validation failed: age must be between 0 and 120");
        }

        const existingUser = this.findByName(user.name);
        if (existingUser) {
            throw new Error("User already exists");
        }

        if (this.db) {
            this.db.save(user);
        }
    }

    /**
     * find user by name from db
     */
    public findByName(name: string): User | undefined {
        return this.db?.find(name);
    }
}