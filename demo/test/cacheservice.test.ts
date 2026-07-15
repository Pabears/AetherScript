// 📋 来源: CacheService JSDoc 契约（src/service/cache-service.ts）
// ⛔ 本文件编写时未读取任何 impl 代码

import { describe, test, expect, spyOn, beforeEach } from 'bun:test';
import { CacheServiceImpl } from '../src/generated/cacheservice.impl';
import { User } from '../src/entity/user';

describe('CacheService 黑盒契约测试', () => {
    let svc: CacheServiceImpl;

    beforeEach(() => {
        svc = new CacheServiceImpl();
    });

    // ─── cacheUser / getCachedUser ─────────────────────────────

    test('✅ [happy] cacheUser → getCachedUser 能取回同一个 user', async () => {
        const user = new User('Alice', 30);
        const setSpy = spyOn(svc['redisLikeCache'], 'set');
        const getSpy = spyOn(svc['redisLikeCache'], 'get');

        await svc.cacheUser('user-1', user);
        expect(setSpy).toHaveBeenCalledWith('user-1', user);

        const found = await svc.getCachedUser('user-1');
        expect(getSpy).toHaveBeenCalledWith('user-1');
        expect(found).toBe(user); // useClones: false so it should be the same object reference
    });

    test('✅ [returns] getCachedUser 未命中 → null', async () => {
        const found = await svc.getCachedUser('ghost-user');
        expect(found).toBeNull();
    });

    // ─── clearUserCache ────────────────────────────────────────

    test('✅ [happy] clearUserCache 存在的 key → true，并删除', async () => {
        const user = new User('Bob', 25);
        await svc.cacheUser('user-2', user);

        const delSpy = spyOn(svc['redisLikeCache'], 'del');
        const result = await svc.clearUserCache('user-2');
        expect(delSpy).toHaveBeenCalledWith('user-2');
        expect(result).toBe(true);

        const found = await svc.getCachedUser('user-2');
        expect(found).toBeNull();
    });

    test('❌ [returns] clearUserCache 不存在的 key → false', async () => {
        const result = await svc.clearUserCache('ghost-user');
        expect(result).toBe(false);
    });

    // ─── cacheData / getCachedData ─────────────────────────────

    test('✅ [happy] cacheData → getCachedData 能取回', async () => {
        const data = { x: 42 };
        const setSpy = spyOn(svc['redisLikeCache'], 'set');
        const getSpy = spyOn(svc['redisLikeCache'], 'get');

        await svc.cacheData('data-1', data);
        expect(setSpy).toHaveBeenCalledWith('data-1', data);

        const found = await svc.getCachedData('data-1');
        expect(getSpy).toHaveBeenCalledWith('data-1');
        expect(found).toBe(data);
    });

    test('✅ [returns] getCachedData 未命中 → undefined', async () => {
        const found = await svc.getCachedData('ghost-data');
        expect(found).toBeUndefined();
    });

    // ─── clearCache ────────────────────────────────────────────

    test('✅ [happy] clearCache 存在的 key → true，并删除', async () => {
        await svc.cacheData('data-2', 'val');
        const delSpy = spyOn(svc['redisLikeCache'], 'del');
        const result = await svc.clearCache('data-2');
        expect(delSpy).toHaveBeenCalledWith('data-2');
        expect(result).toBe(true);

        const found = await svc.getCachedData('data-2');
        expect(found).toBeUndefined();
    });

    test('❌ [returns] clearCache 不存在的 key → false', async () => {
        const result = await svc.clearCache('ghost-data');
        expect(result).toBe(false);
    });
});
