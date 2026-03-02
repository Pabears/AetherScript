import { User } from "./user";
import { DB } from "./db-service";

// @autogen
export abstract class UserService {
    // @AutoGen
    public db?: DB;
    // 1. check: 3 < name.length < 15 and 0 <= age <= 120
    // 2. check: if user already exists (by name), throw an error "User already exists"
    // 3. db.save(user)
    public abstract create(user: User): void;

    // find user by name from db
    public abstract findByName(name: string): User | undefined;
}