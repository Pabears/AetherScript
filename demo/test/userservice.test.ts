import { describe, it, expect, beforeEach } from 'bun:test';
import { UserServiceImpl } from '../src/generated/userservice.impl';
import { DBImpl } from '../src/generated/db.impl';
import { User } from '../src/entity/user';

describe('UserServiceImpl', () => {
    let userService: UserServiceImpl;
    let db: DBImpl;

    beforeEach(() => {
        db = new DBImpl();
        userService = new UserServiceImpl();
        userService.db = db;
    });

    describe('create', () => {
        it('should save user to db if name and age are within valid range', () => {
            const user = new User('Alice', 25);
            userService.create(user);

            const saved = db.find('Alice');
            expect(saved).toBe(user);
        });

        // Edge case: name = 'Ab' (length 2) -> throw error
        it('should throw error if name length is 2 (less than 3)', () => {
            const user = new User('Ab', 25);
            expect(() => {
                userService.create(user);
            }).toThrow('Invalid username length: must be between 3 and 15 characters.');
        });

        // Edge case: name = 'Abc' (length 3) -> valid
        it('should allow name length of 3', () => {
            const user = new User('Abc', 25);
            userService.create(user);
            expect(db.find('Abc')).toBe(user);
        });

        // Edge case: name = 'A'.repeat(15) (length 15) -> valid
        it('should allow name length of 15', () => {
            const name = 'A'.repeat(15);
            const user = new User(name, 25);
            userService.create(user);
            expect(db.find(name)).toBe(user);
        });

        // Edge case: name = 'A'.repeat(16) (length 16) -> throw error
        it('should throw error if name length is 16 (greater than 15)', () => {
            const name = 'A'.repeat(16);
            const user = new User(name, 25);
            expect(() => {
                userService.create(user);
            }).toThrow('Invalid username length: must be between 3 and 15 characters.');
        });

        // Edge case: age = 0 -> valid
        it('should allow age = 0', () => {
            const user = new User('Alice', 0);
            userService.create(user);
            expect(db.find('Alice')).toBe(user);
        });

        // Edge case: age = 120 -> valid
        it('should allow age = 120', () => {
            const user = new User('Alice', 120);
            userService.create(user);
            expect(db.find('Alice')).toBe(user);
        });

        // Edge case: age = -1 -> throw error
        it('should throw error if age = -1', () => {
            const user = new User('Alice', -1);
            expect(() => {
                userService.create(user);
            }).toThrow('Invalid age: must be between 0 and 120.');
        });

        // Edge case: age = 121 -> throw error
        it('should throw error if age = 121', () => {
            const user = new User('Alice', 121);
            expect(() => {
                userService.create(user);
            }).toThrow('Invalid age: must be between 0 and 120.');
        });
    });

    describe('findByName', () => {
        it('should return the user if found', () => {
            const user = new User('Alice', 25);
            db.save(user);
            const found = userService.findByName('Alice');
            expect(found).toBe(user);
        });

        it('should return undefined if user not found', () => {
            const found = userService.findByName('Bob');
            expect(found).toBeUndefined();
        });
    });
});
