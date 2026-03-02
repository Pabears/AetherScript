import { describe, it, expect, beforeEach } from "bun:test";
import { CacheControllerImpl } from "../src/generated/cachecontroller.impl";
import { CacheService } from "../src/service/cache-service";
import { User } from "../src/entity/user";

describe("CacheControllerImpl", () => {
    let controller: CacheControllerImpl;
    let mockCacheService: any;
    let testUser: User;

    beforeEach(() => {
        mockCacheService = {
            cacheUser: async (userId: string, user: User) => {},
            getCachedUser: async (userId: string) => null
        };

        controller = new CacheControllerImpl();
        // Inject the mock dependency
        controller.cacheService = mockCacheService as unknown as CacheService;

        // Setup test data
        testUser = {
            id: "user-123",
            name: "John Doe",
            email: "john@example.com"
        } as User;
    });

    describe("cacheUserData", () => {
        it("should cache user data and return success message", async () => {
            let capturedUserId: string | undefined;
            let capturedUser: User | undefined;
            
            mockCacheService.cacheUser = async (userId: string, user: User) => {
                capturedUserId = userId;
                capturedUser = user;
            };

            const result = await controller.cacheUserData("user-123", testUser);

            expect(result).toBe("User user-123 data cached successfully");
            expect(capturedUserId).toBe("user-123");
            expect(capturedUser).toEqual(testUser);
        });

        it("should return an error message if cacheService is undefined", async () => {
            controller.cacheService = undefined as any;
            
            const result = await controller.cacheUserData("user-123", testUser);

            expect(result).toBe("Error: CacheService not initialized");
        });
    });

    describe("getUserFromCache", () => {
        it("should return the user from cache", async () => {
            mockCacheService.getCachedUser = async (userId: string) => {
                if (userId === "user-123") return testUser;
                return null;
            };

            const result = await controller.getUserFromCache("user-123");

            expect(result).toEqual(testUser);
        });

        it("should return null if user is not found in cache", async () => {
            mockCacheService.getCachedUser = async (userId: string) => {
                return null;
            };

            const result = await controller.getUserFromCache("unknown-user");

            expect(result).toBeNull();
        });

        it("should return null if cacheService is undefined", async () => {
            controller.cacheService = undefined as any;
            
            const result = await controller.getUserFromCache("user-123");

            expect(result).toBeNull();
        });
    });
});