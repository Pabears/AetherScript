import { AutoGen } from "./decorators";

export class User {
    constructor(public name: string, public age: number) {

    }
}
export interface UserService {
    create(user: User): void;
}
export class UserController {
    @AutoGen
    public userService?: UserService;

    create(user: User): void {
        this.userService!.create(user);
    }
}
