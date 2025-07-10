import { AutoGen } from "aesc";
import { User } from "../entity/user";
import { UserService } from "../service/user-service";

export class UserController {
    @AutoGen
    public userService?: UserService;

    create(user: User): void {
        this.userService!.create(user);
    }
    find(name: string): User | undefined {
        return this.userService!.findByName(name)
    }
}
