export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export interface Task {
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: TaskStatus;
    assigneeId?: string;
    createdAt: Date;
    updatedAt: Date;
}
