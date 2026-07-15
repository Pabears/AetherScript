// 📋 来源: DB JSDoc 契约（src/service/db-service.ts）
// ⛔ 本文件编写时未读取任何 impl 代码

import { describe, test, expect, beforeEach } from 'bun:test';
import { DBImpl } from '../src/generated/db.impl';
import { User } from '../src/entity/user';

describe('DB 黑盒契约测试', () => {
    let db: DBImpl;

    beforeEach(() => {
        db = new DBImpl();
    });

    // ─── save / find ──────────────────────────────────────────

    test('✅ [happy] save → find 能取回同一个 user', () => {
        // 来源: @description save step1: 以 user.name 为 key 存入
        const user = new User('Alice', 30);
        db.save(user);
        const found = db.find('Alice');
        expect(found).toBeDefined();
        expect(found?.name).toBe('Alice');
        expect(found?.age).toBe(30);
    });

    test('✅ [happy] save 覆盖旧数据', () => {
        // 来源: @description save step2: 如果 key 已存在，覆盖旧数据
        db.save(new User('Bob', 25));
        db.save(new User('Bob', 99));
        expect(db.find('Bob')?.age).toBe(99);
    });

    test('✅ [returns] find 未命中 → undefined', () => {
        // 来源: @returns 找到的 User 对象，或 undefined
        expect(db.find('NonExistent')).toBeUndefined();
    });

    test('✅ [happy] find 区分大小写', () => {
        // 来源: @description find: 以 name 为 key 查找，区分大小写
        db.save(new User('Alice', 30));
        expect(db.find('alice')).toBeUndefined();
        expect(db.find('ALICE')).toBeUndefined();
        expect(db.find('Alice')).toBeDefined();
    });

    // ─── saveObject / findObject ───────────────────────────────

    test('✅ [happy] saveObject → findObject 能取回', () => {
        // 来源: @description saveObject step1: 以 key 为键存入
        const data = { x: 42, label: 'test' };
        db.saveObject('my-key', data);
        expect(db.findObject('my-key')).toEqual(data);
    });

    test('✅ [happy] saveObject 覆盖旧值', () => {
        // 来源: @description saveObject step2: 如果 key 已存在，覆盖旧数据
        db.saveObject('k', 'old');
        db.saveObject('k', 'new');
        expect(db.findObject('k')).toBe('new');
    });

    test('✅ [returns] findObject 未命中 → undefined', () => {
        // 来源: @returns 存储的数据，或 undefined
        expect(db.findObject('no-such-key')).toBeUndefined();
    });

    // ─── getAllKeys ────────────────────────────────────────────

    test('✅ [happy] getAllKeys 返回所有已存入的 key', () => {
        // 来源: @description getAllKeys: 返回所有 key 的数组
        db.saveObject('a', 1);
        db.saveObject('b', 2);
        db.save(new User('Charlie', 20)); // user key = 'Charlie'
        const keys = db.getAllKeys();
        expect(keys).toContain('a');
        expect(keys).toContain('b');
        expect(keys).toContain('Charlie');
    });

    test('✅ [edge] 空 DB getAllKeys 返回空数组', () => {
        // 来源: @returns 所有 key 的字符串数组
        expect(db.getAllKeys()).toHaveLength(0);
    });

    // ─── deleteObject ─────────────────────────────────────────

    test('✅ [happy] deleteObject 存在的 key → true，并删除', () => {
        // 来源: @description deleteObject step2: 存在并删除返回 true
        db.saveObject('del-me', 'value');
        const result = db.deleteObject('del-me');
        expect(result).toBe(true);
        expect(db.findObject('del-me')).toBeUndefined();
    });

    test('❌ [returns] deleteObject 不存在的 key → false', () => {
        // 来源: @returns 删除成功返回 true，key 不存在返回 false
        expect(db.deleteObject('ghost')).toBe(false);
    });
});
