// Generated from /Users/shiheng/myproject/AetherScript/demo_task_manager/src/service/user-service.ts
// Generated from /Users/shiheng/myproject/AetherScript/demo_task_manager/src/service/user-service.ts
import { UserService } from '../service/user-service';
import type { User } from '../entity/user';
import type { DBService } from '../service/db-service';

export class UserServiceImpl extends UserService {
    /**
     * Create a new user with the given username and email
     * 1. Check if a user with the same email already exists
     * 2. Generate a new ID using dbService
     * 3. Save the new user object to the 'users' collection
     */
    public async createUser(username: string, email: string): Promise<User> {
        if (!this.dbService) {
            throw new Error('DBService not initialized');
        }

        const existingUser = await this.findUserByEmail(email);
        if (existingUser) {
            throw new Error(`User with email ${email} already exists`);
        }

        const user: User = {
            id: this.dbService.generateId(),
            username,
            email,
            createdAt: new Date()
        };

        const success = await this.dbService.saveObject('users', user);
        if (!success) {
            throw new Error('Failed to save user to database');
        }

        return user;
    }

    /**
     * Find a user by their ID using dbService.findObjectById in the 'users' collection
     */
    public async findUserById(id: string): Promise<User | undefined> {
        if (!this.dbService) {
            throw new Error('DBService not initialized');
        }
        return await this.dbService.findObjectById('users', id);
    }

    /**
     * Find a user by their exact email using dbService.findObjectsByField in the 'users' collection
     */
    public async findUserByEmail(email: string): Promise<User | undefined> {
        if (!this.dbService) {
            throw new Error('DBService not initialized');
        }
        const users = await this.dbService.findObjectsByField('users', 'email', email);
        return users && users.length > 0 ? users[0] : undefined;
    }
}