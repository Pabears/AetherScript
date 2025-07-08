import { AutoGen } from "./decorators";

export class User {
    constructor(public name: string, public age: number) {

    }
}
export interface UserService {
    // 3<name.len()<15
    // 0<=age<=120
    // save user to users
    create(user: User, users: Map<string, User>): void;

    // find user from users by name
    findByName(name: string, users: Map<string, User>): User | undefined;
}
export class UserController {
    @AutoGen
    public userService?: UserService;
    private users: Map<string, User> = new Map();

    create(user: User): void {
        this.userService!.create(user, this.users);
    }
    find(name: string): User | undefined {
        return this.userService!.findByName(name, this.users)
    }
}
