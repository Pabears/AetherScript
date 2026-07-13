// 📋 来源: NotificationService JSDoc 契约（src/service/notification-service.ts）
// ⛔ 本文件编写时未读取任何 impl 代码

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NotificationServiceImpl } from '../src/generated/notificationservice.impl';
import { Customer } from '../src/entity/customer';
import { Order, OrderStatus } from '../src/entity/order';

// Mock CacheService（来源: autoGenDependencies → CacheService）
function makeMockCacheService() {
    const cache = new Map<string, any>();
    return {
        cacheUser: mock(async () => {}),
        getCachedUser: mock(async () => null),
        clearUserCache: mock(async () => true),
        cacheData: mock(async (k: string, v: any) => { cache.set(k, v); }),
        getCachedData: mock(async (k: string) => cache.get(k)),
        clearCache: mock(async () => true),
        _cache: cache,
    };
}

function makeCustomer(name = 'Alice') {
    return new Customer('cust-001', name, `${name.toLowerCase()}@test.com`);
}

function makeOrder(id = 'ord-001', items = 2) {
    return new Order(id, 'cust-001', Array(items).fill({ productId: 'p1', quantity: 1, unitPrice: 100 }), OrderStatus.PENDING, new Date(), 100 * items);
}

describe('NotificationService 黑盒契约测试', () => {
    let mockCache: ReturnType<typeof makeMockCacheService>;
    let svc: NotificationServiceImpl;
    let customer: Customer;
    let order: Order;

    beforeEach(() => {
        mockCache = makeMockCacheService();
        svc = new NotificationServiceImpl();
        svc.cacheService = mockCache as any;
        customer = makeCustomer('Alice');
        order = makeOrder();
    });

    // ─── sendOrderConfirmation ────────────────────────────────

    test('✅ [happy] sendOrderConfirmation → 返回 true', async () => {
        // 来源: @returns 发送成功返回 true
        const result = await svc.sendOrderConfirmation(customer, order);
        expect(result).toBe(true);
    });

    test('✅ [happy] sendOrderConfirmation → cacheData 被调用（持久化历史）', async () => {
        // 来源: @description step 5: 调用 cacheService.cacheData
        await svc.sendOrderConfirmation(customer, order);
        expect(mockCache.cacheData).toHaveBeenCalledTimes(1);
    });

    test('✅ [happy] sendOrderConfirmation → 通知 key 包含 customerId', async () => {
        // 来源: @description step 5: key = 'notification:' + customer.id
        await svc.sendOrderConfirmation(customer, order);
        const [[key]] = mockCache.cacheData.mock.calls as string[][];
        expect(key).toContain(customer.id);
    });

    test('✅ [happy] 连续发两次通知 → 历史数组追加（不覆盖）', async () => {
        // 来源: @description step 4: 追加 message 到历史数组
        await svc.sendOrderConfirmation(customer, order);
        await svc.sendOrderConfirmed(customer, order);
        const history = await svc.getNotificationHistory(customer.id);
        expect(history.length).toBeGreaterThanOrEqual(2);
    });

    // ─── sendOrderConfirmed ────────────────────────────────────

    test('✅ [happy] sendOrderConfirmed → 返回 true', async () => {
        // 来源: @returns 发送成功返回 true
        expect(await svc.sendOrderConfirmed(customer, order)).toBe(true);
    });

    test('✅ [happy] sendOrderConfirmed → cacheData 被调用', async () => {
        // 来源: @description step 3: 相同的缓存逻辑
        await svc.sendOrderConfirmed(customer, order);
        expect(mockCache.cacheData).toHaveBeenCalled();
    });

    // ─── sendPaymentConfirmation ───────────────────────────────

    test('✅ [happy] sendPaymentConfirmation → 返回 true', async () => {
        // 来源: @returns 发送成功返回 true
        expect(await svc.sendPaymentConfirmation(customer, order)).toBe(true);
    });

    test('✅ [happy] sendPaymentConfirmation → cacheData 被调用', async () => {
        // 来源: @description step 3: 更新通知历史
        await svc.sendPaymentConfirmation(customer, order);
        expect(mockCache.cacheData).toHaveBeenCalled();
    });

    // ─── sendOrderCancellation ────────────────────────────────

    test('✅ [happy] sendOrderCancellation → 返回 true', async () => {
        // 来源: @returns 发送成功返回 true
        expect(await svc.sendOrderCancellation(customer, order)).toBe(true);
    });

    // ─── getNotificationHistory ───────────────────────────────

    test('✅ [happy] getNotificationHistory 有历史时返回数组', async () => {
        // 来源: @description step 2: 若返回值为数组则返回
        await svc.sendOrderConfirmation(customer, order);
        const history = await svc.getNotificationHistory(customer.id);
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBeGreaterThan(0);
    });

    test('✅ [edge] getNotificationHistory 无记录 → 返回空数组', async () => {
        // 来源: @description step 2: 否则返回空数组
        const history = await svc.getNotificationHistory('no-such-id');
        expect(Array.isArray(history)).toBe(true);
        expect(history).toHaveLength(0);
    });
});
