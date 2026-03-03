// Generated from /Users/shiheng/myproject/AetherScript/demo_task_manager/src/service/task-service.ts
// Generated from /Users/shiheng/myproject/AetherScript/demo_task_manager/src/service/task-service.ts
import type { Task, TaskStatus } from '../entity/task';
import { TaskService } from '../service/task-service';

export class TaskServiceImpl extends TaskService {
    public async createTask(projectId: string, title: string, description: string): Promise<Task> {
        if (!this.projectService) throw new Error('projectService is not defined');
        if (!this.dbService) throw new Error('dbService is not defined');

        const project = await this.projectService.findProjectById(projectId);
        if (!project) {
            throw new Error(`Project with ID ${projectId} does not exist`);
        }

        const task: Task = {
            id: this.dbService.generateId(),
            projectId,
            title,
            description,
            status: 'TODO',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await this.dbService.saveObject('tasks', task);
        return task;
    }

    public async assignTask(taskId: string, userId: string): Promise<boolean> {
        if (!this.userService) throw new Error('userService is not defined');
        if (!this.dbService) throw new Error('dbService is not defined');

        const task = await this.dbService.findObjectById('tasks', taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} does not exist`);
        }

        const user = await this.userService.findUserById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} does not exist`);
        }

        task.assigneeId = userId;
        task.updatedAt = new Date();
        await this.dbService.saveObject('tasks', task);

        return true;
    }

    public async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<Task> {
        if (!this.dbService) throw new Error('dbService is not defined');

        const task = await this.dbService.findObjectById('tasks', taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} does not exist`);
        }

        let isValid = false;
        switch (task.status) {
            case 'TODO':
                if (newStatus === 'IN_PROGRESS') isValid = true;
                break;
            case 'IN_PROGRESS':
                if (newStatus === 'REVIEW' || newStatus === 'DONE' || newStatus === 'TODO') isValid = true;
                break;
            case 'REVIEW':
                if (newStatus === 'DONE' || newStatus === 'IN_PROGRESS') isValid = true;
                break;
            case 'DONE':
                // No transitions out of DONE are permitted
                break;
        }

        if (!isValid) {
            throw new Error(`Invalid status transition from ${task.status} to ${newStatus}`);
        }

        task.status = newStatus;
        task.updatedAt = new Date();
        await this.dbService.saveObject('tasks', task);

        return task;
    }

    public async getCompletionPercentage(projectId: string): Promise<number> {
        if (!this.dbService) throw new Error('dbService is not defined');

        const tasks: Task[] = await this.dbService.findObjectsByField('tasks', 'projectId', projectId);
        if (tasks.length === 0) {
            return 0;
        }

        const doneTasks = tasks.filter((t: Task) => t.status === 'DONE');
        return (doneTasks.length / tasks.length) * 100;
    }
}