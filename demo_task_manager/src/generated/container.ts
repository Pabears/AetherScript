
import { DBServiceImpl } from './dbservice.impl';
import { ProjectServiceImpl } from './projectservice.impl';
import { TaskServiceImpl } from './taskservice.impl';
import { UserServiceImpl } from './userservice.impl';

class Container {
    private services = new Map<string, any>();

    constructor() {
        this.registerServices();
    }

    private registerServices() {
        // 1. Instantiate
        const dBService = new DBServiceImpl();
        const projectService = new ProjectServiceImpl();
        const taskService = new TaskServiceImpl();
        const userService = new UserServiceImpl();

        // 2. Inject
        projectService.dbService = dBService; // Injected DBService
        taskService.dbService = dBService; // Injected DBService
        taskService.userService = userService; // Injected UserService
        taskService.projectService = projectService; // Injected ProjectService
        userService.dbService = dBService; // Injected DBService

        // 3. Register
        this.services.set('DBService', dBService);
        this.services.set('ProjectService', projectService);
        this.services.set('TaskService', taskService);
        this.services.set('UserService', userService);
    }

    public get(name: string): any {
        return this.services.get(name);
    }
}

export const container = new Container();
