import { User } from './user';

export abstract class DB {
    // save user to db
    abstract save(user: User): void;
    // find user by name
    abstract find(name: string): User | undefined;
}
