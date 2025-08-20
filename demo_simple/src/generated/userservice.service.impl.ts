import { UserService } from "../user-service";
import { DB } from "../db-service";
import { User } from "../user";
import { AutoGen } from "aesc";

export class UserServiceImpl extends UserService {
    // 1. check: 3 < name.length < 15 and 0 <= age <= 120
    // 2. db.save(user)
    public create(user: User): void {
        if (this.db === undefined) {
            throw new Error("DB is not set");
        }
        
        const { name, age } = user;
        
        if (name.length < 3 || name.length > 15 || age < 0 || age > 120) {
            throw new Error(`Invalid user: ${name} - ${age}`);
        }
        
        this.db.save(user);
    }
    
    // find user by name from db
    public findByName(name: string): User | undefined {
        if (this.db === undefined) {
            throw new Error("DB is not set");
        }
        
        return this.db.find(name);
    }
}