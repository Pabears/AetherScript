import { User } from "../entity/user";
import { UserService } from "../service/user-service";

export class UserServiceImpl extends UserService {
    // 1. check: 3 < name.length < 15 and 0 <= age <= 120
    // 2. db.save(user)
    public create(user: User): void {
        if (user.name.length < 3 || user.name.length > 15 || user.age < 0 || user.age > 120) {
            throw new Error('Invalid input');
        }

        this.db!.save(user);
    }

    // find user by name from db
    public findByName(name: string): User | undefined {
        return this.db?.find(name);
    }
}