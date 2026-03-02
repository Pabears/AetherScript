import { describe, it, expect, beforeEach } from "bun:test";
import { DBImpl } from "../src/generated/db.impl";

describe("DBImpl", () => {
    let db: DBImpl;
    let mockCache: any;

    beforeEach(() => {
        db = new DBImpl();
        
        // Mock NodeCache dependency
        mockCache = {
            data: new Map(),
            set: function(key: string, val: any) {
                this.data.set(key, val);
                return true;
            },
            get: function(key: string) {
                return this.data.get(key);
            },
            keys: function() {
                return Array.from(this.data.keys());
            },
            del: function(key: string) {
                const existed = this.data.has(key);
                this.data.delete(key);
                return existed ? 1 : 0;
            }
        };

        // Inject the mock cache into the DBImpl instance
        (db as any).cache = mockCache;
    });

    describe("saveObject", () => {
        it("should save an object with an id to the cache", () => {
            const obj = { id: "123", name: "Test Object" };
            db.saveObject(obj);
            expect(mockCache.data.get("123")).toEqual(obj);
        });

        it("should not save if object is falsy", () => {
            db.saveObject(null);
            expect(mockCache.data.size).toBe(0);
        });

        it("should not save if object has no id", () => {
            const obj = { name: "No ID" };
            db.saveObject(obj);
            expect(mockCache.data.size).toBe(0);
        });
    });

    describe("findObject", () => {
        it("should return the object if found in the cache", () => {
            const obj = { id: "123", name: "Test Object" };
            mockCache.data.set("123", obj);
            
            const result = db.findObject("123");
            expect(result).toEqual(obj);
        });

        it("should return undefined if object is not found", () => {
            const result = db.findObject("nonexistent");
            expect(result).toBeUndefined();
        });
    });

    describe("save", () => {
        it("should delegate to saveObject", () => {
            const obj = { id: "456", name: "Legacy Save" };
            db.save(obj);
            expect(mockCache.data.get("456")).toEqual(obj);
        });
    });

    describe("find", () => {
        it("should delegate to findObject", () => {
            const obj = { id: "456", name: "Legacy Find" };
            mockCache.data.set("456", obj);
            
            const result = db.find("456");
            expect(result).toEqual(obj);
        });
    });

    describe("getAllObjects", () => {
        it("should return all objects currently stored in the cache", () => {
            const obj1 = { id: "1", name: "First" };
            const obj2 = { id: "2", name: "Second" };
            mockCache.data.set("1", obj1);
            mockCache.data.set("2", obj2);
            
            const results = db.getAllObjects();
            expect(results).toBeArray();
            expect(results.length).toBe(2);
            expect(results).toContain(obj1);
            expect(results).toContain(obj2);
        });

        it("should return an empty array if cache is empty", () => {
            const results = db.getAllObjects();
            expect(results).toBeArray();
            expect(results.length).toBe(0);
        });
    });

    describe("getAll", () => {
        it("should delegate to getAllObjects", () => {
            const obj = { id: "1", name: "First" };
            mockCache.data.set("1", obj);
            
            const results = db.getAll();
            expect(results).toBeArray();
            expect(results.length).toBe(1);
            expect(results).toContain(obj);
        });
    });

    describe("findAll", () => {
        it("should delegate to getAllObjects", () => {
            const obj = { id: "1", name: "First" };
            mockCache.data.set("1", obj);
            
            const results = db.findAll();
            expect(results).toBeArray();
            expect(results.length).toBe(1);
            expect(results).toContain(obj);
        });
    });

    describe("deleteObject", () => {
        it("should delete object from cache and return true if it existed", () => {
            const obj = { id: "123", name: "To Delete" };
            mockCache.data.set("123", obj);
            
            const result = db.deleteObject("123");
            expect(result).toBeTrue();
            expect(mockCache.data.has("123")).toBeFalse();
        });

        it("should return false if the object did not exist in cache", () => {
            const result = db.deleteObject("nonexistent");
            expect(result).toBeFalse();
        });
    });
});