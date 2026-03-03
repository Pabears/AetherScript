// Generated from /Users/shiheng/myproject/AetherScript/demo_task_manager/src/service/project-service.ts
// Generated from /Users/shiheng/myproject/AetherScript/demo_task_manager/src/service/project-service.ts
import type { Project } from '../entity/project';
import type { DBService } from '../service/db-service';
import { ProjectService } from '../service/project-service';

export class ProjectServiceImpl extends ProjectService {
    /**
     * Create a new project assigned to the specific ownerId.
     * Generates a new ID, sets the creation date, and saves it to the 'projects' collection.
     */
    public override async createProject(name: string, description: string, ownerId: string): Promise<Project> {
        if (!this.dbService) {
            throw new Error('DBService is not initialized');
        }

        const project: Project = {
            id: this.dbService.generateId(),
            name,
            description,
            ownerId,
            createdAt: new Date()
        };

        await this.dbService.saveObject('projects', project);
        return project;
    }

    /**
     * Find a project by its ID from the 'projects' collection.
     */
    public override async findProjectById(id: string): Promise<Project | undefined> {
        if (!this.dbService) {
            throw new Error('DBService is not initialized');
        }

        return await this.dbService.findObjectById('projects', id);
    }

    /**
     * Get all projects owned by a specific ownerId from the 'projects' collection.
     */
    public override async getProjectsByOwnerId(ownerId: string): Promise<Project[]> {
        if (!this.dbService) {
            throw new Error('DBService is not initialized');
        }

        return await this.dbService.findObjectsByField('projects', 'ownerId', ownerId);
    }
}