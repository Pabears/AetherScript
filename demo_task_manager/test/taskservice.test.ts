import { describe, it, expect, beforeEach, mock } from "bun:test";
import { TaskServiceImpl } from "../src/generated/taskservice.impl";

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

function createMockDependency() {
    const mocks: Record<string, any> = {};
    return new Proxy({}, {
        get(target, prop: string) {
            if (prop === 'then') return undefined; // Promise bypass
            if (!mocks[prop]) {
                const isArray = prop.includes('findObjects') || prop.includes('getAll') || prop.includes('findTasks') || prop.includes('getTasks');
                mocks[prop] = mock(() => Promise.resolve(isArray ? [] : undefined));
            }
            return mocks[prop];
        },
        set(target, prop: string, value: any) {
            mocks[prop] = value;
            return true;
        }
    });
}

describe("TaskServiceImpl", () => {
    let taskService: TaskServiceImpl;
    let dbServiceMock: any;
    let userServiceMock: any;
    let projectServiceMock: any;

    beforeEach(() => {
        taskService = new TaskServiceImpl();
        dbServiceMock = createMockDependency();
        userServiceMock = createMockDependency();
        projectServiceMock = createMockDependency();

        taskService.dbService = dbServiceMock;
        taskService.userService = userServiceMock;
        taskService.projectService = projectServiceMock;
    });

    describe("createTask", () => {
        it("should create a new task when project exists", async () => {
            const mockProject = { id: "proj-1" };
            projectServiceMock.getProject = mock().mockResolvedValue(mockProject);
            projectServiceMock.findObjectById = mock().mockResolvedValue(mockProject);
            projectServiceMock.getProjectById = mock().mockResolvedValue(mockProject);
            projectServiceMock.findById = mock().mockResolvedValue(mockProject);
            projectServiceMock.findProjectById = mock().mockResolvedValue(mockProject);

            dbServiceMock.saveTask = mock().mockImplementation((task: any) => Promise.resolve(task));
            dbServiceMock.createObject = mock().mockImplementation((col: any, task: any) => Promise.resolve(task));
            dbServiceMock.createTask = mock().mockImplementation((task: any) => Promise.resolve(task));
            dbServiceMock.save = mock().mockImplementation((task: any) => Promise.resolve(task));
            dbServiceMock.insert = mock().mockImplementation((task: any) => Promise.resolve(task));

            const task = await taskService.createTask("proj-1", "Test Task", "Description");
            expect(task).toBeDefined();
            expect(task.projectId).toBe("proj-1");
            expect(task.title).toBe("Test Task");
            expect(task.description).toBe("Description");
            expect(task.status).toBe("TODO");
        });

        it("should throw an error if the project does not exist", async () => {
            projectServiceMock.getProject = mock().mockResolvedValue(undefined);
            projectServiceMock.findObjectById = mock().mockResolvedValue(undefined);
            projectServiceMock.getProjectById = mock().mockResolvedValue(undefined);
            projectServiceMock.findById = mock().mockResolvedValue(undefined);

            expect(taskService.createTask("proj-invalid", "Test Task", "Description")).rejects.toThrow();
        });
    });

    describe("assignTask", () => {
        it("should assign a task to a user successfully", async () => {
            const mockTask = { id: "task-1", status: "TODO" };
            const mockUser = { id: "user-1" };

            dbServiceMock.getTask = mock().mockResolvedValue(mockTask);
            dbServiceMock.findObjectById = mock().mockResolvedValue(mockTask);
            dbServiceMock.getTaskById = mock().mockResolvedValue(mockTask);
            dbServiceMock.findById = mock().mockResolvedValue(mockTask);

            userServiceMock.getUser = mock().mockResolvedValue(mockUser);
            userServiceMock.findObjectById = mock().mockResolvedValue(mockUser);
            userServiceMock.getUserById = mock().mockResolvedValue(mockUser);
            userServiceMock.findById = mock().mockResolvedValue(mockUser);
            userServiceMock.findUserById = mock().mockResolvedValue(mockUser);

            const result = await taskService.assignTask("task-1", "user-1");
            expect(result).toBe(true);
        });

        it("should throw an error if task does not exist", async () => {
            const mockUser = { id: "user-1" };

            dbServiceMock.getTask = mock().mockResolvedValue(undefined);
            dbServiceMock.findObjectById = mock().mockResolvedValue(undefined);
            dbServiceMock.getTaskById = mock().mockResolvedValue(undefined);
            dbServiceMock.findById = mock().mockResolvedValue(undefined);

            userServiceMock.getUser = mock().mockResolvedValue(mockUser);
            userServiceMock.findObjectById = mock().mockResolvedValue(mockUser);
            userServiceMock.getUserById = mock().mockResolvedValue(mockUser);
            userServiceMock.findById = mock().mockResolvedValue(mockUser);

            expect(taskService.assignTask("task-invalid", "user-1")).rejects.toThrow();
        });

        it("should throw an error if user does not exist", async () => {
            const mockTask = { id: "task-1", status: "TODO" };

            dbServiceMock.getTask = mock().mockResolvedValue(mockTask);
            dbServiceMock.findObjectById = mock().mockResolvedValue(mockTask);
            dbServiceMock.getTaskById = mock().mockResolvedValue(mockTask);
            dbServiceMock.findById = mock().mockResolvedValue(mockTask);

            userServiceMock.getUser = mock().mockResolvedValue(undefined);
            userServiceMock.findObjectById = mock().mockResolvedValue(undefined);
            userServiceMock.getUserById = mock().mockResolvedValue(undefined);
            userServiceMock.findById = mock().mockResolvedValue(undefined);

            expect(taskService.assignTask("task-1", "user-invalid")).rejects.toThrow();
        });
    });

    describe("updateTaskStatus", () => {
        const setupMockTask = (status: TaskStatus) => {
            const mockTask = { id: "task-1", status };
            dbServiceMock.getTask = mock().mockResolvedValue(mockTask);
            dbServiceMock.findObjectById = mock().mockResolvedValue(mockTask);
            dbServiceMock.getTaskById = mock().mockResolvedValue(mockTask);
            dbServiceMock.findById = mock().mockResolvedValue(mockTask);

            // Mocking update/save methods
            dbServiceMock.updateTask = mock().mockImplementation((t: any) => Promise.resolve(t));
            dbServiceMock.updateObject = mock().mockImplementation((c: any, t: any) => Promise.resolve(t));
            dbServiceMock.save = mock().mockImplementation((t: any) => Promise.resolve(t));
            dbServiceMock.update = mock().mockImplementation((t: any) => Promise.resolve(t));

            return mockTask;
        };

        it("should allow valid transition TODO -> IN_PROGRESS", async () => {
            setupMockTask("TODO");
            const task = await taskService.updateTaskStatus("task-1", "IN_PROGRESS" as TaskStatus);
            expect(task).toBeDefined();
            expect(task.status).toBe("IN_PROGRESS");
        });

        it("should allow valid transition IN_PROGRESS -> REVIEW", async () => {
            setupMockTask("IN_PROGRESS");
            const task = await taskService.updateTaskStatus("task-1", "REVIEW" as TaskStatus);
            expect(task.status).toBe("REVIEW");
        });

        it("should allow valid transition IN_PROGRESS -> DONE", async () => {
            setupMockTask("IN_PROGRESS");
            const task = await taskService.updateTaskStatus("task-1", "DONE" as TaskStatus);
            expect(task.status).toBe("DONE");
        });

        it("should allow valid transition IN_PROGRESS -> TODO", async () => {
            setupMockTask("IN_PROGRESS");
            const task = await taskService.updateTaskStatus("task-1", "TODO" as TaskStatus);
            expect(task.status).toBe("TODO");
        });

        it("should allow valid transition REVIEW -> DONE", async () => {
            setupMockTask("REVIEW");
            const task = await taskService.updateTaskStatus("task-1", "DONE" as TaskStatus);
            expect(task.status).toBe("DONE");
        });

        it("should allow valid transition REVIEW -> IN_PROGRESS", async () => {
            setupMockTask("REVIEW");
            const task = await taskService.updateTaskStatus("task-1", "IN_PROGRESS" as TaskStatus);
            expect(task.status).toBe("IN_PROGRESS");
        });

        it("should throw an error for invalid transition TODO -> DONE", async () => {
            setupMockTask("TODO");
            expect(taskService.updateTaskStatus("task-1", "DONE" as TaskStatus)).rejects.toThrow();
        });

        it("should throw an error for invalid transition DONE -> IN_PROGRESS", async () => {
            setupMockTask("DONE");
            expect(taskService.updateTaskStatus("task-1", "IN_PROGRESS" as TaskStatus)).rejects.toThrow();
        });

        it("should throw an error if task does not exist", async () => {
            dbServiceMock.getTask = mock().mockResolvedValue(undefined);
            dbServiceMock.findObjectById = mock().mockResolvedValue(undefined);
            dbServiceMock.getTaskById = mock().mockResolvedValue(undefined);
            dbServiceMock.findById = mock().mockResolvedValue(undefined);

            expect(taskService.updateTaskStatus("task-invalid", "IN_PROGRESS" as TaskStatus)).rejects.toThrow();
        });
    });

    describe("getCompletionPercentage", () => {
        const setupMockTasks = (tasks: any[]) => {
            dbServiceMock.findTasksByProject = mock().mockResolvedValue(tasks);
            dbServiceMock.getTasksByProjectId = mock().mockResolvedValue(tasks);
            dbServiceMock.findObjectsByField = mock().mockResolvedValue(tasks);
            dbServiceMock.findByField = mock().mockResolvedValue(tasks);

            projectServiceMock.getTasks = mock().mockResolvedValue(tasks);
        };

        it("should return correct percentage when tasks exist", async () => {
            const tasks = [
                { id: "task-1", status: "DONE" },
                { id: "task-2", status: "DONE" },
                { id: "task-3", status: "TODO" },
                { id: "task-4", status: "IN_PROGRESS" }
            ];
            setupMockTasks(tasks);

            const percentage = await taskService.getCompletionPercentage("proj-1");
            expect(percentage).toBe(50);
        });

        it("should return 0 when there are no tasks", async () => {
            setupMockTasks([]);

            const percentage = await taskService.getCompletionPercentage("proj-1");
            expect(percentage).toBe(0);
        });

        it("should return 100 when all tasks are done", async () => {
            const tasks = [
                { id: "task-1", status: "DONE" },
                { id: "task-2", status: "DONE" }
            ];
            setupMockTasks(tasks);

            const percentage = await taskService.getCompletionPercentage("proj-1");
            expect(percentage).toBe(100);
        });

        it("should return 0 when no tasks are done", async () => {
            const tasks = [
                { id: "task-1", status: "TODO" },
                { id: "task-2", status: "IN_PROGRESS" }
            ];
            setupMockTasks(tasks);

            const percentage = await taskService.getCompletionPercentage("proj-1");
            expect(percentage).toBe(0);
        });
    });
});