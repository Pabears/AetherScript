import { AutoGen } from "aesc";
import { User } from "./user";
import { DB } from "./db-service";



export abstract class UserService {
    @AutoGen
    public db?: DB;
    // 1. check: 3 < name.length < 15 and 0 <= age <= 120
    // 2. db.save(user)
    public abstract create(user: User): void;

    // find user by name from db
    public abstract findByName(name: string): User | undefined;
}