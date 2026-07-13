// 📋 来源: UserService JSDoc 契约（src/service/user-service.ts）
// ⛔ 本文件编写时未读取任何 impl 代码

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { UserServiceImpl } from '../src/generated/userservice.impl';
import { User } from '../src/entity/user';

describe('UserService 黑盒契约测试', () => {
    let mockDb: { save: ReturnType<typeof mock>; find: ReturnType<typeof mock>; saveObject: ReturnType<typeof mock>; findObject: ReturnType<typeof mock>; getAllKeys: ReturnType<typeof mock>; deleteObject: ReturnType<typeof mock> };
    let svc: UserServiceImpl;

    beforeEach(() => {
        mockDb = {
            save: mock(() => {}),
            find: mock(() => undefined),
            saveObject: mock(() => {}),
            findObject: mock(() => undefined),
            getAllKeys: mock(() => []),
            deleteObject: mock(() => false),
        };
        svc = new UserServiceImpl();
        svc.db = mockDb as any;
    });

    // ─── create: Happy Path ────────────────────────────────────

    test('✅ [happy] 合法用户 → db.save 被调用一次', () => {
        // 来源: @description step 4: 调用 this.db!.save(user)
        const user = new User('Alice', 30);
        svc.create(user);
        expect(mockDb.save).toHaveBeenCalledTimes(1);
        expect(mockDb.save).toHaveBeenCalledWith(user);
    });

    // ─── create: @throws 覆盖 ─────────────────────────────────

    test('❌ [throws] name 长度 < 3 → 抛出 Error', () => {
        // 来源: @throws Error 如果 name 长度不在 [3, 15] 范围内
        expect(() => svc.create(new User('Al', 30))).toThrow();
    });

    test('❌ [throws] name 长度 > 15 → 抛出 Error', () => {
        // 来源: @throws Error 如果 name 长度不在 [3, 15] 范围内
        expect(() => svc.create(new User('A'.repeat(16), 30))).toThrow();
    });

    test('❌ [throws] age < 0 → 抛出 Error', () => {
        // 来源: @throws Error 如果 age 不在 [0, 120] 范围内
        expect(() => svc.create(new User('Bob', -1))).toThrow();
    });

    test('❌ [throws] age > 120 → 抛出 Error', () => {
        // 来源: @throws Error 如果 age 不在 [0, 120] 范围内
        expect(() => svc.create(new User('Bob', 121))).toThrow();
    });

    test('❌ [throws] 验证失败时 db.save 不应被调用', () => {
        // 来源: @description step 3: 如果验证失败，抛出 Error，不执行后续步骤
        try { svc.create(new User('Al', 30)); } catch {}
        expect(mockDb.save).not.toHaveBeenCalled();
    });

    test('❌ [throws] age 验证失败时 db.save 不应被调用', () => {
        // 来源: @description step 3: 副作用隔离
        try { svc.create(new User('Alice', -1)); } catch {}
        expect(mockDb.save).not.toHaveBeenCalled();
    });

    // ─── create: @edge-cases 覆盖 ─────────────────────────────

    test('✅ [edge] name 恰好 3 字符 → 合法，不抛错', () => {
        // 来源: @edge-cases name = 'Abc'（长度3）→ 合法
        expect(() => svc.create(new User('Abc', 25))).not.toThrow();
    });

    test('✅ [edge] name 恰好 15 字符 → 合法，不抛错', () => {
        // 来源: @edge-cases name = 'A'.repeat(15)（长度15）→ 合法
        expect(() => svc.create(new User('A'.repeat(15), 25))).not.toThrow();
    });

    test('✅ [edge] age = 0 → 合法，不抛错', () => {
        // 来源: @edge-cases age = 0 → 合法
        expect(() => svc.create(new User('Bob', 0))).not.toThrow();
    });

    test('✅ [edge] age = 120 → 合法，不抛错', () => {
        // 来源: @edge-cases age = 120 → 合法
        expect(() => svc.create(new User('Bob', 120))).not.toThrow();
    });

    // ─── findByName ────────────────────────────────────────────

    test('✅ [happy] findByName → 调用 db.find 并返回结果', () => {
        // 来源: @description step 1: 调用 this.db!.find(name)
        const user = new User('Alice', 30);
        mockDb.find = mock(() => user);
        const result = svc.findByName('Alice');
        expect(mockDb.find).toHaveBeenCalledWith('Alice');
        expect(result).toBe(user);
    });

    test('✅ [returns] findByName 未命中 → undefined', () => {
        // 来源: @returns 找到的 User 对象，或 undefined
        mockDb.find = mock(() => undefined);
        expect(svc.findByName('Ghost')).toBeUndefined();
    });
});
