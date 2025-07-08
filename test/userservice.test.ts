import { describe, it, expect } from 'bun:test';
import { container } from '../src/generated/container';
import { UserController, User } from '../src/user';

describe('UserController', () => {
    const userController = new UserController();
    userController.userService = container.get('UserService');

    it('should create a user with a valid name and age', () => {
        const user = new User('JohnDoe', 30);
        // Expect no error to be thrown
        expect(() => userController.create(user)).not.toThrow();
    });

    it('should throw an error for a username that is too short', () => {
        const user = new User('Jo', 25);
        expect(() => userController.create(user)).toThrow();
    });

    it('should throw an error for a username that is too long', () => {
        const user = new User('ThisNameIsWayTooLong', 40);
        expect(() => userController.create(user)).toThrow();
    });

    it('should throw an error for an age less than 0', () => {
        const user = new User('ValidName', -1);
        expect(() => userController.create(user)).toThrow();
    });

    it('should throw an error for an age greater than 120', () => {
        const user = new User('ValidName', 121);
        expect(() => userController.create(user)).toThrow();
    });

    // Boundary tests
    it('should create a user with minimum valid name length (4)', () => {
        const user = new User('Four', 28);
        expect(() => userController.create(user)).not.toThrow();
    });

    it('should create a user with maximum valid name length (14)', () => {
        const user = new User('FourteenLength', 35);
        expect(() => userController.create(user)).not.toThrow();
    });

    it('should create a user with minimum valid age (0)', () => {
        const user = new User('Baby', 0);
        expect(() => userController.create(user)).not.toThrow();
    });

    it('should create a user with maximum valid age (120)', () => {
        const user = new User('OldMan', 120);
        expect(() => userController.create(user)).not.toThrow();
    });
});


