
import { DBImpl } from './db.impl';
import { UserServiceImpl } from './userservice.impl';

class Container {
    private services = new Map<string, any>();

    constructor() {
        this.registerServices();
    }

    private registerServices() {
        // 1. Instantiate
        const dB = new DBImpl();
        const userService = new UserServiceImpl();

        // 2. Inject
        userService.db = dB; // Injected DB

        // 3. Register
        this.services.set('DB', dB);
        this.services.set('UserService', userService);
    }

    public get(name: string): any {
        return this.services.get(name);
    }
}

export const container = new Container();
