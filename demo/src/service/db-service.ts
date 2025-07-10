import { User } from "../entity/user";
export abstract class DB {
    protected users = new Map<string, User>();

    // save user to users
    public abstract save(user: User): void;
    // find user from users
    public abstract find(name: string): User | undefined;
}