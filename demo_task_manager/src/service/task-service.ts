import { Task, TaskStatus } from '../entity/task';
import { DBService } from './db-service';
import { UserService } from './user-service';
import { ProjectService } from './project-service';

// @autogen
export abstract class TaskService {
    // @AutoGen
    public dbService?: DBService;

    // @AutoGen
    public userService?: UserService;

    // @AutoGen
    public projectService?: ProjectService;

    // Create a new task under a specific project, with status initialized to 'TODO'
    // Throw an error if the project does not exist
    public abstract createTask(projectId: string, title: string, description: string): Promise<Task>;

    // Assign a task to a specific user
    // Throw an error if the task or user does not exist
    // Return true on success
    public abstract assignTask(taskId: string, userId: string): Promise<boolean>;

    // Change a task's status
    // Only allow valid transitions:
    // TODO -> IN_PROGRESS
    // IN_PROGRESS -> REVIEW or DONE or TODO
    // REVIEW -> DONE or IN_PROGRESS
    // If an invalid transition is attempted, throw an error
    public abstract updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<Task>;

    // Calculate the percentage of tasks inside a project that have status 'DONE'
    // Returns a number between 0 and 100
    // Returns 0 if there are no tasks
    public abstract getCompletionPercentage(projectId: string): Promise<number>;
}
