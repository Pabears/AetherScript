import { describe, it, expect, beforeEach } from 'bun:test';
import { CacheServiceImpl } from '../src/generated/cacheservice.impl';
import { User } from '../src/entity/user';

describe('CacheServiceImpl', () => {
    let cacheService: CacheServiceImpl;

    beforeEach(() => {
        cacheService = new CacheServiceImpl();
    });

    describe('cacheUser and getCachedUser', () => {
        it('should cache a user and retrieve it back', async () => {
            const user = new User('Bob', 30);
            await cacheService.cacheUser('user:bob', user);
            const cached = await cacheService.getCachedUser('user:bob');
            expect(cached).toBe(user); // useClones is false, so it should be the same object reference
        });

        it('should return null if user cache does not exist', async () => {
            const cached = await cacheService.getCachedUser('user:nonexistent');
            expect(cached).toBeNull();
        });
    });

    describe('clearUserCache', () => {
        it('should clear cached user and return true if existed', async () => {
            const user = new User('Bob', 30);
            await cacheService.cacheUser('user:bob', user);
            const cleared = await cacheService.clearUserCache('user:bob');
            expect(cleared).toBe(true);
            const cached = await cacheService.getCachedUser('user:bob');
            expect(cached).toBeNull();
        });

        it('should return false when clearing non-existent user cache', async () => {
            const cleared = await cacheService.clearUserCache('user:nonexistent');
            expect(cleared).toBe(false);
        });
    });

    describe('cacheData and getCachedData', () => {
        it('should cache arbitrary data and retrieve it back', async () => {
            const data = { token: 'xyz', roles: ['admin'] };
            await cacheService.cacheData('session:123', data);
            const cached = await cacheService.getCachedData('session:123');
            expect(cached).toBe(data);
        });

        it('should return undefined if data cache does not exist', async () => {
            const cached = await cacheService.getCachedData('session:nonexistent');
            expect(cached).toBeUndefined();
        });
    });

    describe('clearCache', () => {
        it('should clear cached data and return true if existed', async () => {
            await cacheService.cacheData('key1', 'val1');
            const cleared = await cacheService.clearCache('key1');
            expect(cleared).toBe(true);
            const cached = await cacheService.getCachedData('key1');
            expect(cached).toBeUndefined();
        });

        it('should return false when clearing non-existent cache', async () => {
            const cleared = await cacheService.clearCache('key-missing');
            expect(cleared).toBe(false);
        });
    });
});
