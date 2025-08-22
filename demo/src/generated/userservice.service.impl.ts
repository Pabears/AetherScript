import { UserService } from "../service/user-service";
import { DB } from "../service/db-service";
import { User } from "../entity/user";
import { AutoGen } from "aesc";

export class UserServiceImpl extends UserService {
    public create(user: User): void {
        if (user.name.length <= 3 || user.name.length >= 15 || user.age < 0 || user.age > 120) {
            throw new Error("Invalid user data");
        }
        this.db?.save(user);
    }

    public findByName(name: string): User | undefined {
        return this.db?.find(name);
    }
}