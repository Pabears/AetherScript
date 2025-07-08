import { AutoGen } from "./decorators";

export class User {
    constructor(public name: string, public age: number) {

    }
}
export abstract class UserService {
    //save user to db and check the user's name and age
    //3<username.length()<15
    //0<=age<=120
    create(user: User): void;
}
export class UserController {
    @AutoGen
    public userService?: UserService;

    create(user: User): void {
        this.userService!.create(user);
    }
}
