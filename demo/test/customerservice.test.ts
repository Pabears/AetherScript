// 📋 来源: CustomerService JSDoc 契约（src/service/customer-service.ts）
// ⛔ 本文件编写时未读取任何 impl 代码

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { CustomerServiceImpl } from '../src/generated/customerservice.impl';
import { Customer } from '../src/entity/customer';

// Mock DB 接口（来源: autoGenDependencies → DB）
function makeMockDb() {
    const store = new Map<string, any>();
    return {
        save: mock(() => {}),
        find: mock(() => undefined),
        saveObject: mock((k: string, v: any) => { store.set(k, v); }),
        findObject: mock((k: string) => store.get(k)),
        getAllKeys: mock(() => [...store.keys()]),
        deleteObject: mock((k: string) => store.delete(k)),
        _store: store,
    };
}

describe('CustomerService 黑盒契约测试', () => {
    let mockDb: ReturnType<typeof makeMockDb>;
    let svc: CustomerServiceImpl;

    beforeEach(() => {
        mockDb = makeMockDb();
        svc = new CustomerServiceImpl();
        svc.db = mockDb as any;
    });

    // ─── createCustomer: Happy Path ────────────────────────────

    test('✅ [happy] 合法 name+email → 返回含 id 的 Customer', () => {
        // 来源: @returns 创建的 Customer 对象（含生成的 id）
        const c = svc.createCustomer('Alice', 'alice@example.com');
        expect(c).toBeDefined();
        expect(c.name).toBe('Alice');
        expect(c.email).toBe('alice@example.com');
        expect(c.id).toBeTruthy(); // 生成了 UUID
    });

    test('✅ [happy] 创建后 db.saveObject 被调用', () => {
        // 来源: @description step 4: 调用 db.saveObject(customerId, customer)
        svc.createCustomer('Bob', 'bob@example.com');
        expect(mockDb.saveObject).toHaveBeenCalledTimes(1);
    });

    test('✅ [happy] 可选参数 phone/address 可不传', () => {
        // 来源: @param phone - 可选，@param address - 可选
        expect(() => svc.createCustomer('Carol', 'carol@test.com')).not.toThrow();
    });

    // ─── createCustomer: @throws 覆盖 ─────────────────────────

    test('❌ [throws] name 为空 → 抛出 Error', () => {
        // 来源: @throws Error 如果 name 为空或 email 格式无效
        expect(() => svc.createCustomer('', 'a@b.com')).toThrow();
    });

    test('❌ [throws] email 无 @ → 抛出 Error', () => {
        // 来源: @throws Error 如果 name 为空或 email 格式无效
        expect(() => svc.createCustomer('Alice', 'notanemail')).toThrow();
    });

    test('❌ [throws] 重复 email → 抛出 Error', () => {
        // 来源: @throws Error 如果 email 已被其他客户使用
        svc.createCustomer('Alice', 'dup@example.com');
        expect(() => svc.createCustomer('Alice2', 'dup@example.com')).toThrow();
    });

    test('❌ [throws] name 为空时 db.saveObject 不应被调用', () => {
        // 来源: @description step 1 验证先于 step 4 保存（副作用隔离）
        try { svc.createCustomer('', 'a@b.com'); } catch {}
        expect(mockDb.saveObject).not.toHaveBeenCalled();
    });

    // ─── findCustomerById ──────────────────────────────────────

    test('✅ [happy] findCustomerById 找到已保存的客户', () => {
        // 来源: @description step 1: 调用 db.findObject(customerId)
        const c = svc.createCustomer('Dave', 'dave@example.com');
        const found = svc.findCustomerById(c.id);
        expect(found?.email).toBe('dave@example.com');
    });

    test('✅ [returns] findCustomerById 不存在 → undefined', () => {
        // 来源: @returns Customer 对象或 undefined
        expect(svc.findCustomerById('no-such-id')).toBeUndefined();
    });

    // ─── findCustomerByEmail ───────────────────────────────────

    test('✅ [happy] findCustomerByEmail 能按邮箱找到客户', () => {
        // 来源: @description step 2: 找到 email 匹配的客户
        svc.createCustomer('Eve', 'eve@example.com');
        const found = svc.findCustomerByEmail('eve@example.com');
        expect(found?.name).toBe('Eve');
    });

    test('✅ [returns] findCustomerByEmail 不存在 → undefined', () => {
        // 来源: @returns Customer 对象或 undefined
        expect(svc.findCustomerByEmail('ghost@example.com')).toBeUndefined();
    });

    // ─── updateCustomer ────────────────────────────────────────

    test('✅ [happy] updateCustomer 客户存在 → 返回 true', () => {
        // 来源: @returns 更新成功返回 true
        const c = svc.createCustomer('Frank', 'frank@example.com');
        const result = svc.updateCustomer(c.id, { address: 'Beijing' });
        expect(result).toBe(true);
    });

    test('✅ [happy] updateCustomer 后字段被持久化', () => {
        // 来源: @description step 3: 调用 db.saveObject 保存
        const c = svc.createCustomer('Grace', 'grace@example.com');
        svc.updateCustomer(c.id, { name: 'Grace Updated', phone: '138-0000' });
        const updated = svc.findCustomerById(c.id);
        expect(updated?.name).toBe('Grace Updated');
        expect(updated?.phone).toBe('138-0000');
    });

    test('❌ [returns] updateCustomer 客户不存在 → 返回 false', () => {
        // 来源: @returns 客户不存在返回 false
        expect(svc.updateCustomer('ghost-id', { name: 'X' })).toBe(false);
    });

    // ─── getAllCustomers ───────────────────────────────────────

    test('✅ [happy] getAllCustomers 返回所有已创建的客户', () => {
        // 来源: @returns 所有客户的数组
        svc.createCustomer('H1', 'h1@example.com');
        svc.createCustomer('H2', 'h2@example.com');
        expect(svc.getAllCustomers().length).toBeGreaterThanOrEqual(2);
    });

    test('✅ [edge] 空 DB getAllCustomers 返回空数组', () => {
        // 来源: @returns 无数据时返回空数组
        expect(svc.getAllCustomers()).toHaveLength(0);
    });
});
