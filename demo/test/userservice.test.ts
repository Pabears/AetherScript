import { describe, it, expect, beforeEach } from "bun:test";
import { UserServiceImpl } from "../src/generated/userservice.impl";
import { User } from "../src/entity/user";

describe("UserServiceImpl", () => {
    let userService: UserServiceImpl;
    let mockDb: any;
    let mockUsers: User[];

    beforeEach(() => {
        mockUsers = [];
        mockDb = {
            save: (user: User) => {
                mockUsers.push(user);
            },
            getAll: () => {
                return mockUsers;
            }
        };

        userService = new UserServiceImpl();
        userService.db = mockDb;
    });

    describe("create", () => {
        it("should successfully create and save a valid user", () => {
            const validUser = { name: "John", age: 30 } as User;
            userService.create(validUser);
            
            expect(mockUsers.length).toBe(1);
            expect(mockUsers[0]).toEqual(validUser);
        });

        it("should throw an error if the name is 3 characters or less", () => {
            const invalidUser = { name: "Bob", age: 25 } as User; // length 3
            expect(() => userService.create(invalidUser)).toThrow(/Invalid user data/);
        });

        it("should throw an error if the name is 15 characters or more", () => {
            const invalidUser = { name: "ThisIsTooLongName", age: 25 } as User; // length 17
            expect(() => userService.create(invalidUser)).toThrow(/Invalid user data/);
        });

        it("should throw an error if the age is negative", () => {
            const invalidUser = { name: "ValidName", age: -1 } as User;
            expect(() => userService.create(invalidUser)).toThrow(/Invalid user data/);
        });

        it("should throw an error if the age is greater than 120", () => {
            const invalidUser = { name: "ValidName", age: 121 } as User;
            expect(() => userService.create(invalidUser)).toThrow(/Invalid user data/);
        });

        it("should handle valid user creation when db is undefined", () => {
            const validUser = { name: "John", age: 30 } as User;
            userService.db = undefined;
            
            // Should not throw, and obviously cannot save to our mock
            expect(() => userService.create(validUser)).not.toThrow();
            expect(mockUsers.length).toBe(0);
        });
    });

    describe("findByName", () => {
        it("should return the user if they exist in the database", () => {
            const user1 = { name: "Alice", age: 28 } as User;
            const user2 = { name: "Charlie", age: 35 } as User;
            mockUsers.push(user1, user2);

            const result = userService.findByName("Alice");
            expect(result).toEqual(user1);
        });

        it("should return undefined if the user does not exist in the database", () => {
            const user1 = { name: "Alice", age: 28 } as User;
            mockUsers.push(user1);

            const result = userService.findByName("Bob");
            expect(result).toBeUndefined();
        });

        it("should return undefined if db is undefined", () => {
            const user1 = { name: "Alice", age: 28 } as User;
            mockUsers.push(user1);
            userService.db = undefined;

            const result = userService.findByName("Alice");
            expect(result).toBeUndefined();
        });
    });
});