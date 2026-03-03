import { describe, it, expect, beforeEach, mock } from "bun:test";
import { DBServiceImpl } from "../src/generated/dbservice.impl";

describe("DBServiceImpl", () => {
    let dbService: DBServiceImpl;

    beforeEach(() => {
        dbService = new DBServiceImpl();
    });

    it("should generate a unique ID", () => {
        const id1 = dbService.generateId();
        const id2 = dbService.generateId();
        
        expect(id1).toBeDefined();
        expect(typeof id1).toBe("string");
        expect(id1.length).toBeGreaterThan(0);
        expect(id1).not.toEqual(id2);
    });

    it("should save an object to a specific collection and return true", async () => {
        const obj = { id: "test-1", name: "Test Object 1" };
        const result = await dbService.saveObject("projects", obj);
        
        expect(result).toBe(true);
    });

    it("should find a specific object by its ID within a collection", async () => {
        const obj = { id: "test-2", name: "Test Object 2" };
        await dbService.saveObject("users", obj);
        
        const found = await dbService.findObjectById("users", "test-2");
        
        expect(found).toBeDefined();
        expect(found.id).toBe("test-2");
        expect(found.name).toBe("Test Object 2");
    });

    it("should return undefined when finding a non-existent object by ID", async () => {
        const found = await dbService.findObjectById("users", "non-existent-id");
        
        expect(found).toBeUndefined();
    });

    it("should find all objects in a collection matching a specific field/value pair", async () => {
        const obj1 = { id: "t-1", status: "TODO", title: "Task 1" };
        const obj2 = { id: "t-2", status: "DONE", title: "Task 2" };
        const obj3 = { id: "t-3", status: "TODO", title: "Task 3" };
        
        await dbService.saveObject("tasks", obj1);
        await dbService.saveObject("tasks", obj2);
        await dbService.saveObject("tasks", obj3);
        
        const foundTasks = await dbService.findObjectsByField("tasks", "status", "TODO");
        
        expect(foundTasks).toBeInstanceOf(Array);
        // It should find at least the two we just added
        const foundIds = foundTasks.map(t => t.id);
        expect(foundIds).toContain("t-1");
        expect(foundIds).toContain("t-3");
        expect(foundIds).not.toContain("t-2");
    });

    it("should get all objects inside a collection", async () => {
        const obj1 = { id: "p-1", name: "Project A" };
        const obj2 = { id: "p-2", name: "Project B" };
        
        await dbService.saveObject("all_projects", obj1);
        await dbService.saveObject("all_projects", obj2);
        
        const allProjects = await dbService.getAllObjects("all_projects");
        
        expect(allProjects).toBeInstanceOf(Array);
        expect(allProjects.length).toBeGreaterThanOrEqual(2);
        
        const ids = allProjects.map(p => p.id);
        expect(ids).toContain("p-1");
        expect(ids).toContain("p-2");
    });

    it("should return an empty array when getting all objects from an empty collection", async () => {
        const allObjects = await dbService.getAllObjects("empty_collection_test");
        
        expect(allObjects).toBeInstanceOf(Array);
        expect(allObjects).toHaveLength(0);
    });

    it("should delete an object from a collection", async () => {
        const obj = { id: "delete-1", name: "To Be Deleted" };
        await dbService.saveObject("delete_test", obj);
        
        let found = await dbService.findObjectById("delete_test", "delete-1");
        expect(found).toBeDefined();
        
        const deleteResult = await dbService.deleteObject("delete_test", "delete-1");
        expect(deleteResult).toBe(true);
        
        found = await dbService.findObjectById("delete_test", "delete-1");
        expect(found).toBeUndefined();
    });
});