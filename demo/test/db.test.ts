import { describe, it, expect, beforeEach } from 'bun:test';
import { DBImpl } from '../src/generated/db.impl';
import { User } from '../src/entity/user';

describe('DBImpl', () => {
    let db: DBImpl;

    beforeEach(() => {
        db = new DBImpl();
    });

    describe('save and find', () => {
        it('should save a user with name as key and find it back', () => {
            const user = new User('Alice', 25);
            db.save(user);
            const found = db.find('Alice');
            expect(found).toBe(user);
        });

        it('should overwrite old user data if the key already exists', () => {
            const user1 = new User('Alice', 25);
            const user2 = new User('Alice', 30);
            db.save(user1);
            db.save(user2);
            const found = db.find('Alice');
            expect(found).toBe(user2);
            expect(found?.age).toBe(30);
        });

        it('should return undefined if user is not found', () => {
            const found = db.find('NonExistent');
            expect(found).toBeUndefined();
        });

        it('should be case sensitive when finding a user', () => {
            const user = new User('Alice', 25);
            db.save(user);
            expect(db.find('alice')).toBeUndefined();
            expect(db.find('ALICE')).toBeUndefined();
            expect(db.find('Alice')).toBe(user);
        });
    });

    describe('saveObject and findObject', () => {
        it('should save an arbitrary object with key and retrieve it', () => {
            const data = { id: 1, val: 'test' };
            db.saveObject('myKey', data);
            const found = db.findObject('myKey');
            expect(found).toBe(data);
        });

        it('should overwrite old object data if the key already exists', () => {
            const data1 = { val: 'first' };
            const data2 = { val: 'second' };
            db.saveObject('myKey', data1);
            db.saveObject('myKey', data2);
            const found = db.findObject('myKey');
            expect(found).toBe(data2);
        });

        it('should return undefined if object is not found', () => {
            const found = db.findObject('missing');
            expect(found).toBeUndefined();
        });

        it('should be case sensitive when finding an object', () => {
            const data = { val: 'test' };
            db.saveObject('MyKey', data);
            expect(db.findObject('mykey')).toBeUndefined();
            expect(db.findObject('MYKEY')).toBeUndefined();
            expect(db.findObject('MyKey')).toBe(data);
        });
    });

    describe('getAllKeys', () => {
        it('should return all stored keys', () => {
            expect(db.getAllKeys()).toEqual([]);
            db.save(new User('Alice', 25));
            db.saveObject('customKey', { a: 1 });
            const keys = db.getAllKeys();
            expect(keys).toContain('Alice');
            expect(keys).toContain('customKey');
            expect(keys.length).toBe(2);
        });
    });

    describe('deleteObject', () => {
        it('should delete object and return true if key exists', () => {
            db.saveObject('toDelete', { val: 1 });
            const deleteResult = db.deleteObject('toDelete');
            expect(deleteResult).toBe(true);
            expect(db.findObject('toDelete')).toBeUndefined();
        });

        it('should return false if key does not exist', () => {
            const deleteResult = db.deleteObject('nonExistent');
            expect(deleteResult).toBe(false);
        });
    });
});
