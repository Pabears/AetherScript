import { User } from "../entity/user";
import { UserService } from "../service/user-service";

export class UserServiceImpl extends UserService {
    public create(user: User): void {
        if (3 < user.name.length && user.name.length < 15 && 0 <= user.age && user.age <= 120) {
            this.db.save(user);
        } else {
            throw new Error("Invalid user data");
        }
    }

    public findByName(name: string): User | undefined {
        return this.db.find(name);
    }
}