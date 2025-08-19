import { AutoGen } from 'aesc';
import { User } from './user';
import { DB } from './db-service';

export abstract class UserService {
    @AutoGen
    public db?: DB;

    // create a new user
    abstract create(user: User): void;

    // find a user by name
    abstract findByName(name: string): User | undefined;
}
