import { describe, it, expect, beforeEach, mock } from "bun:test";
import { CacheServiceImpl } from "../src/generated/cacheservice.impl";
import { User } from "../src/entity/user";

describe("CacheServiceImpl", () => {
    let cacheService: CacheServiceImpl;
    let mockRedisCache: any;

    beforeEach(() => {
        mockRedisCache = {
            set: mock(() => {}),
            get: mock((key: string) => {
                if (key === "existingUser") return { id: 1, name: "Test User" } as User;
                if (key === "existingData") return { some: "data" };
                return undefined;
            }),
            del: mock((key: string) => {
                if (key === "existingKey") return 1;
                return 0;
            })
        };

        cacheService = new CacheServiceImpl();
        // Mocking the internal redisLikeCache dependency
        (cacheService as any).redisLikeCache = mockRedisCache;
    });

    describe("cacheUser", () => {
        it("should cache a user successfully", async () => {
            const user = new User();
            user.id = 1;
            user.username = "testuser";

            await cacheService.cacheUser("user:1", user);

            expect(mockRedisCache.set).toHaveBeenCalledWith("user:1", user);
        });
    });

    describe("getCachedUser", () => {
        it("should return a user if it exists in cache", async () => {
            const result = await cacheService.getCachedUser("existingUser");

            expect(mockRedisCache.get).toHaveBeenCalledWith("existingUser");
            expect(result).toBeDefined();
            expect(result?.name).toBe("Test User");
        });

        it("should return null if user does not exist in cache", async () => {
            const result = await cacheService.getCachedUser("nonExistingUser");

            expect(mockRedisCache.get).toHaveBeenCalledWith("nonExistingUser");
            expect(result).toBeNull();
        });
    });

    describe("clearUserCache", () => {
        it("should return true if user cache was cleared successfully", async () => {
            const result = await cacheService.clearUserCache("existingKey");

            expect(mockRedisCache.del).toHaveBeenCalledWith("existingKey");
            expect(result).toBe(true);
        });

        it("should return false if user cache to clear was not found", async () => {
            const result = await cacheService.clearUserCache("nonExistingKey");

            expect(mockRedisCache.del).toHaveBeenCalledWith("nonExistingKey");
            expect(result).toBe(false);
        });
    });

    describe("cacheData", () => {
        it("should cache arbitrary data successfully", async () => {
            const data = { foo: "bar" };

            await cacheService.cacheData("data:1", data);

            expect(mockRedisCache.set).toHaveBeenCalledWith("data:1", data);
        });
    });

    describe("getCachedData", () => {
        it("should return arbitrary data if it exists in cache", async () => {
            const result = await cacheService.getCachedData("existingData");

            expect(mockRedisCache.get).toHaveBeenCalledWith("existingData");
            expect(result).toEqual({ some: "data" });
        });

        it("should return undefined if arbitrary data does not exist in cache", async () => {
            const result = await cacheService.getCachedData("nonExistingData");

            expect(mockRedisCache.get).toHaveBeenCalledWith("nonExistingData");
            expect(result).toBeUndefined();
        });
    });

    describe("clearCache", () => {
        it("should return true if cache was cleared successfully", async () => {
            const result = await cacheService.clearCache("existingKey");

            expect(mockRedisCache.del).toHaveBeenCalledWith("existingKey");
            expect(result).toBe(true);
        });

        it("should return false if cache to clear was not found", async () => {
            const result = await cacheService.clearCache("nonExistingKey");

            expect(mockRedisCache.del).toHaveBeenCalledWith("nonExistingKey");
            expect(result).toBe(false);
        });
    });
});