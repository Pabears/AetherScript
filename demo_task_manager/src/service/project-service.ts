import { Project } from '../entity/project';
import { DBService } from './db-service';

// @autogen
export abstract class ProjectService {
    // @AutoGen
    public dbService?: DBService;

    // Create a new project assigned to the specific ownerId
    // Save to the 'projects' collection using dbService
    public abstract createProject(name: string, description: string, ownerId: string): Promise<Project>;

    // Find a project by its ID
    public abstract findProjectById(id: string): Promise<Project | undefined>;

    // Get all projects owned by a specific ownerId
    public abstract getProjectsByOwnerId(ownerId: string): Promise<Project[]>;
}
