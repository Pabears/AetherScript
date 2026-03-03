import { container } from "./generated/container";
import { UserService } from "./service/user-service";
import { ProjectService } from "./service/project-service";
import { TaskService } from "./service/task-service";

async function main() {
    console.log("🚀 === Task Management System Initialization ===");

    // 1. Resolve Services from AI-Generated Container
    const userService = container.get('UserService') as UserService;
    const projectService = container.get('ProjectService') as ProjectService;
    const taskService = container.get('TaskService') as TaskService;

    // 2. Business Flow
    try {
        console.log("👥 1. Registering Users...");
        const alice = await userService.createUser("Alice", "alice@example.com");
        const bob = await userService.createUser("Bob", "bob@example.com");
        console.log(`   Registered ${alice.username} (${alice.id}) and ${bob.username} (${bob.id})`);

        console.log("\n📁 2. Creating Project...");
        const project = await projectService.createProject(
            "AetherScript V2",
            "Self-healing TS-Morph compiler",
            alice.id
        );
        console.log(`   Project Created: '${project.name}' (${project.id}) owned by Alice`);

        console.log("\n📋 3. Creating Tasks...");
        const task1 = await taskService.createTask(project.id, "Design TS-Morph AST Loop", "Design the AST validation loop.");
        const task2 = await taskService.createTask(project.id, "Integrate Retry Logic", "Allow Gemini to see its own compiler errors.");
        const task3 = await taskService.createTask(project.id, "Write Documentation", "Update WALKTHROUGH.md");
        console.log(`   Added 3 Tasks to Project.`);

        console.log("\n👤 4. Assigning Tasks...");
        await taskService.assignTask(task1.id, alice.id);
        await taskService.assignTask(task2.id, bob.id);
        await taskService.assignTask(task3.id, alice.id);

        console.log("\n🔄 5. Managing Workflow...");
        await taskService.updateTaskStatus(task1.id, 'IN_PROGRESS');
        await taskService.updateTaskStatus(task1.id, 'REVIEW');
        await taskService.updateTaskStatus(task1.id, 'DONE');
        console.log(`   Task 1 Status -> DONE`);

        await taskService.updateTaskStatus(task2.id, 'IN_PROGRESS');
        console.log(`   Task 2 Status -> IN_PROGRESS`);

        console.log("\n📊 6. Validating Integrity...");
        const completion = await taskService.getCompletionPercentage(project.id);
        console.log(`   Project '${project.name}' Completion: ${completion.toFixed(2)}%`);

        if (completion !== 33.33 && completion !== (1 / 3) * 100 && Math.abs(completion - 33.33) > 1) {
            throw new Error(`Completion percentage calculated incorrectly: ${completion}`);
        }

        console.log("\n✅ === End-to-End Task Manager Test Passed! ===\n");
    } catch (e: any) {
        console.error("\n❌ Test Failed: ", e.message);
        process.exit(1);
    }
}

main();
