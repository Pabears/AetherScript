import { User } from '../entity/user';
import { DBService } from './db-service';

// @autogen
export abstract class UserService {
    // @AutoGen
    public dbService?: DBService;

    // Create a new user with the given username and email
    // Throw an error if a user with that email already exists
    // Save the user to the 'users' collection using dbService
    public abstract createUser(username: string, email: string): Promise<User>;

    // Find a user by their ID using dbService
    public abstract findUserById(id: string): Promise<User | undefined>;

    // Find a user by their exact email using dbService
    public abstract findUserByEmail(email: string): Promise<User | undefined>;
}
