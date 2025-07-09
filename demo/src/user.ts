import { AutoGen } from "aesc";

export class User {
    constructor(public name: string, public age: number) {

    }
}

export abstract class DB {
    protected users = new Map<string, User>();

    // save user to users
    abstract save(user: User): void;
    // find user from users
    abstract find(name: string): User | undefined;
}
export abstract class UserService {
    @AutoGen
    public db?: DB;
    // 1. check: 3<name.len()<15 and 0<=age<=120
    // 2. db.save(user)
    abstract create(user: User): void;

    // 1. check name, 2. db.find(name)
    abstract findByName(name: string): User | undefined;
}
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
