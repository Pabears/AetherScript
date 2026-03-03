import { describe, it, expect, beforeEach, mock } from "bun:test";
import { UserServiceImpl } from "../src/generated/userservice.impl";
import type { User } from "../src/entity/user";

function createMockDependency() {
    const mocks: Record<string, any> = {};
    return new Proxy({}, {
        get(target, prop: string) {
            if (prop === 'then') return undefined; // Promise bypass
            if (!mocks[prop]) {
                // Default to mock returning undefined unless the name implies array
                const isArray = prop.includes('findObjects') || prop.includes('getAll');
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

describe("UserServiceImpl", () => {
    let userService: UserServiceImpl;
    let mockDbService: any;

    beforeEach(() => {
        userService = new UserServiceImpl();
        mockDbService = createMockDependency();
        userService.dbService = mockDbService;
    });

    describe("createUser", () => {
        it("should create a new user and save to 'users' collection", async () => {
            const username = "testuser";
            const email = "test@example.com";
            const expectedUser: User = { id: "1", username, email } as User;

            // Mock finding no existing user by email
            mockDbService.findObjectsByField = mock(() => Promise.resolve([]));
            mockDbService.getObjectByField = mock(() => Promise.resolve(undefined));
            
            // Mock saving the user
            mockDbService.saveObject = mock(() => Promise.resolve(expectedUser));
            mockDbService.createObject = mock(() => Promise.resolve(expectedUser));

            // To support implementations that check this class method internally:
            userService.findUserByEmail = mock(() => Promise.resolve(undefined));

            const user = await userService.createUser(username, email);
            
            expect(user).toBeDefined();
            expect(user.username).toBe(username);
            expect(user.email).toBe(email);
        });

        it("should throw an error if a user with that email already exists", async () => {
            const username = "testuser";
            const email = "test@example.com";
            const existingUser: User = { id: "1", username: "existing", email } as User;

            // Mock finding an existing user by email
            mockDbService.findObjectsByField = mock(() => Promise.resolve([existingUser]));
            mockDbService.getObjectByField = mock(() => Promise.resolve(existingUser));

            // To support implementations that check this class method internally:
            userService.findUserByEmail = mock(() => Promise.resolve(existingUser));

            await expect(userService.createUser(username, email)).rejects.toThrow();
        });
    });

    describe("findUserById", () => {
        it("should find a user by their ID using dbService", async () => {
            const expectedUser: User = { id: "123", username: "testuser", email: "test@example.com" } as User;
            
            mockDbService.getObjectById = mock(() => Promise.resolve(expectedUser));
            mockDbService.findObjectById = mock(() => Promise.resolve(expectedUser));

            const result = await userService.findUserById("123");
            
            expect(result).toBeDefined();
            expect(result?.id).toBe("123");
        });

        it("should return undefined if user is not found", async () => {
            mockDbService.getObjectById = mock(() => Promise.resolve(undefined));
            mockDbService.findObjectById = mock(() => Promise.resolve(undefined));

            const result = await userService.findUserById("999");
            
            expect(result).toBeUndefined();
        });
    });

    describe("findUserByEmail", () => {
        it("should find a user by their exact email using dbService", async () => {
            const email = "test@example.com";
            const expectedUser: User = { id: "123", username: "testuser", email } as User;
            
            mockDbService.findObjectsByField = mock(() => Promise.resolve([expectedUser]));
            mockDbService.getObjectByField = mock(() => Promise.resolve(expectedUser));

            const result = await userService.findUserByEmail(email);
            
            expect(result).toBeDefined();
            expect(result?.email).toBe(email);
        });

        it("should return undefined if user is not found by email", async () => {
            mockDbService.findObjectsByField = mock(() => Promise.resolve([]));
            mockDbService.getObjectByField = mock(() => Promise.resolve(undefined));

            const result = await userService.findUserByEmail("nonexistent@example.com");
            
            expect(result).toBeUndefined();
        });
    });
});