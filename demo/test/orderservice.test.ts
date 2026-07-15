// 📋 来源: OrderService JSDoc 契约（src/service/order-service.ts）
// ⛔ 本文件编写时未读取任何 impl 代码

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { OrderServiceImpl } from '../src/generated/orderservice.impl';
import { Order, OrderStatus } from '../src/entity/order';
import { Product } from '../src/entity/product';
import { Customer } from '../src/entity/customer';

// ─── Mock Factories ────────────────────────────────────────────

function makeMockDb() {
    const store = new Map<string, any>();
    return {
        save: mock(() => {}),
        find: mock(() => undefined),
        saveObject: mock((k: string, v: any) => { store.set(k, v); }),
        findObject: mock((k: string) => store.get(k)),
        getAllKeys: mock(() => [...store.keys()]),
        deleteObject: mock((k: string) => store.delete(k)),
    };
}

function makeMockProductService(stock = 10, price = 100) {
    const product = new Product('prod-1', 'Widget', price, stock, 'Misc');
    return {
        findProductById: mock((id: string) => id === 'prod-1' ? product : undefined),
        reduceStock: mock((id: string, qty: number) => {
            if (product.stock >= qty) { product.stock -= qty; return true; }
            return false;
        }),
        updateStock: mock((id: string, newStock: number) => { product.stock = newStock; return true; }),
        createProduct: mock(() => product),
        findProductsByCategory: mock(() => []),
        getAllProducts: mock(() => [product]),
        _product: product,
    };
}

function makeMockNotificationService() {
    return {
        sendOrderConfirmation: mock(async () => true),
        sendOrderConfirmed: mock(async () => true),
        sendPaymentConfirmation: mock(async () => true),
        sendOrderCancellation: mock(async () => true),
        getNotificationHistory: mock(async () => []),
    };
}

function makeMockCustomerService(customerId = 'cust-1') {
    const customer = new Customer(customerId, 'Alice', 'alice@test.com');
    return {
        findCustomerById: mock((id: string) => id === customerId ? customer : undefined),
        createCustomer: mock(() => customer),
        findCustomerByEmail: mock(() => undefined),
        updateCustomer: mock(() => true),
        getAllCustomers: mock(() => [customer]),
        _customer: customer,
    };
}

describe('OrderService 黑盒契约测试', () => {
    let db: ReturnType<typeof makeMockDb>;
    let productSvc: ReturnType<typeof makeMockProductService>;
    let notificationSvc: ReturnType<typeof makeMockNotificationService>;
    let customerSvc: ReturnType<typeof makeMockCustomerService>;
    let svc: OrderServiceImpl;

    beforeEach(() => {
        db = makeMockDb();
        productSvc = makeMockProductService(10, 100);
        notificationSvc = makeMockNotificationService();
        customerSvc = makeMockCustomerService('cust-1');
        svc = new OrderServiceImpl();
        svc.db = db as any;
        svc.productService = productSvc as any;
        svc.notificationService = notificationSvc as any;
        svc.customerService = customerSvc as any;
    });

    // ─── createOrder: Happy Path ───────────────────────────────

    test('✅ [happy] createOrder 商品存在且库存充足 → 返回 Order', () => {
        // 来源: @returns 创建的 Order 对象
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 2 }]);
        expect(order).toBeDefined();
        expect(order.status).toBe(OrderStatus.PENDING);
        // 来源: @description step 6: 创建 Order（status = PENDING）
    });

    test('✅ [happy] createOrder totalAmount 正确计算', () => {
        // 来源: @description step 5: totalAmount = quantity * unitPrice 之和
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 3 }]);
        expect(order.totalAmount).toBe(300); // 3 * 100
    });

    test('✅ [happy] createOrder → db.saveObject 以 order: 前缀被调用', () => {
        // 来源: @description step 7: 调用 db.saveObject('order:' + orderId, order)
        svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        expect(db.saveObject).toHaveBeenCalledWith(
            expect.stringContaining('order:'),
            expect.objectContaining({ status: OrderStatus.PENDING })
        );
    });

    test('✅ [happy] createOrder 找到客户 → 发送通知', () => {
        // 来源: @description step 8: 若找到客户则发送通知
        svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        expect(notificationSvc.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    });

    test('✅ [happy] createOrder 客户不存在 → 不发通知，但仍成功', () => {
        // 来源: @description step 8: 若找到则发送（找不到则不发）
        svc.createOrder('unknown-cust', [{ productId: 'prod-1', quantity: 1 }]);
        expect(notificationSvc.sendOrderConfirmation).not.toHaveBeenCalled();
    });

    // ─── createOrder: @throws 覆盖 ────────────────────────────

    test('❌ [throws] 商品不存在 → 抛出 Error', () => {
        // 来源: @throws Error 如果商品不存在
        expect(() => svc.createOrder('cust-1', [{ productId: 'non-existent', quantity: 1 }])).toThrow();
    });

    test('❌ [throws] 库存不足 → 抛出 Error', () => {
        // 来源: @throws Error 如果库存不足
        // stock=10, 请求11
        expect(() => svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 11 }])).toThrow();
    });

    test('❌ [throws] 库存不足时 db.saveObject 不应被调用', () => {
        // 来源: @description 副作用隔离（验证先于保存）
        try { svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 11 }]); } catch {}
        expect(db.saveObject).not.toHaveBeenCalled();
    });

    // ─── confirmOrder ──────────────────────────────────────────

    test('✅ [happy] confirmOrder PENDING → CONFIRMED，返回 true', async () => {
        // 来源: @description step 4: 更新 order.status = CONFIRMED
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 2 }]);
        const result = await svc.confirmOrder(order.id);
        expect(result).toBe(true);
        expect(svc.findOrderById(order.id)?.status).toBe(OrderStatus.CONFIRMED);
    });

    test('✅ [happy] confirmOrder → reduceStock 被调用', async () => {
        // 来源: @description step 3: 调用 productService.reduceStock
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 2 }]);
        await svc.confirmOrder(order.id);
        expect(productSvc.reduceStock).toHaveBeenCalledWith('prod-1', 2);
    });

    test('❌ [returns] confirmOrder 订单不存在 → false', async () => {
        // 来源: @returns 订单不存在返回 false
        expect(await svc.confirmOrder('ghost-order')).toBe(false);
    });

    test('❌ [returns] confirmOrder 状态非 PENDING → false', async () => {
        // 来源: @description step 2: 检查 status === PENDING，否则返回 false
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        await svc.confirmOrder(order.id); // PENDING → CONFIRMED
        const doubleConfirm = await svc.confirmOrder(order.id); // CONFIRMED → 不能再 confirm
        expect(doubleConfirm).toBe(false);
    });

    // ─── processPayment ────────────────────────────────────────

    test('✅ [happy] processPayment CONFIRMED → PAID，返回 true', async () => {
        // 来源: @description step 3: 更新 order.status = PAID
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        await svc.confirmOrder(order.id);
        const result = await svc.processPayment(order.id);
        expect(result).toBe(true);
        expect(svc.findOrderById(order.id)?.status).toBe(OrderStatus.PAID);
    });

    test('❌ [returns] processPayment 状态非 CONFIRMED（PENDING）→ false', async () => {
        // 来源: @description step 2: 检查 status === CONFIRMED
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        expect(await svc.processPayment(order.id)).toBe(false);
    });

    test('❌ [returns] processPayment 订单不存在 → false', async () => {
        // 来源: @returns 订单不存在返回 false
        expect(await svc.processPayment('ghost')).toBe(false);
    });

    // ─── cancelOrder ───────────────────────────────────────────

    test('✅ [edge] cancelOrder PENDING 订单 → 不恢复库存，返回 true', async () => {
        // 来源: @edge-cases PENDING 订单取消 → 不需要恢复库存
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        const result = await svc.cancelOrder(order.id);
        expect(result).toBe(true);
        expect(svc.findOrderById(order.id)?.status).toBe(OrderStatus.CANCELLED);
        // PENDING 取消不应调用 updateStock
        expect(productSvc.updateStock).not.toHaveBeenCalled();
    });

    test('✅ [edge] cancelOrder CONFIRMED 订单 → 恢复库存，返回 true', async () => {
        // 来源: @edge-cases CONFIRMED 订单取消 → 必须恢复库存
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 3 }]);
        await svc.confirmOrder(order.id); // 库存减3
        const stockAfterConfirm = productSvc._product.stock; // 10 - 3 = 7
        const result = await svc.cancelOrder(order.id);
        expect(result).toBe(true);
        // 库存应恢复：7 + 3 = 10
        expect(productSvc._product.stock).toBe(stockAfterConfirm + 3);
    });

    test('❌ [edge] cancelOrder PAID 订单 → 返回 false，不能取消', async () => {
        // 来源: @edge-cases PAID/SHIPPED/DELIVERED/CANCELLED → 返回 false
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        await svc.confirmOrder(order.id);
        await svc.processPayment(order.id); // → PAID
        expect(await svc.cancelOrder(order.id)).toBe(false);
        expect(svc.findOrderById(order.id)?.status).toBe(OrderStatus.PAID); // 状态未变
    });

    test('❌ [returns] cancelOrder 订单不存在 → false', async () => {
        // 来源: @returns 订单不存在返回 false
        expect(await svc.cancelOrder('ghost')).toBe(false);
    });

    test('✅ [happy] cancelOrder → sendOrderCancellation 被调用', async () => {
        // 来源: @description step 6: 查找客户，若找到则调用 sendOrderCancellation
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        await svc.cancelOrder(order.id);
        expect(notificationSvc.sendOrderCancellation).toHaveBeenCalledTimes(1);
    });

    // ─── findOrderById / findOrdersByCustomer / getOrdersByStatus ─

    test('✅ [happy] findOrderById 找到已创建订单', () => {
        // 来源: @description step 1: 调用 db.findObject('order:' + orderId)
        const order = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        expect(svc.findOrderById(order.id)?.id).toBe(order.id);
    });

    test('✅ [returns] findOrderById 不存在 → undefined', () => {
        // 来源: @returns Order 对象或 undefined
        expect(svc.findOrderById('ghost')).toBeUndefined();
    });

    test('✅ [happy] findOrdersByCustomer 返回该客户的订单', () => {
        // 来源: @description step 2: 过滤 customerId 匹配的订单
        svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        expect(svc.findOrdersByCustomer('cust-1').length).toBeGreaterThanOrEqual(2);
    });

    test('✅ [happy] getOrdersByStatus 正确过滤状态', async () => {
        // 来源: @description step 2: 过滤 status 匹配的订单
        const o1 = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        const o2 = svc.createOrder('cust-1', [{ productId: 'prod-1', quantity: 1 }]);
        await svc.confirmOrder(o2.id);
        expect(svc.getOrdersByStatus(OrderStatus.PENDING).length).toBeGreaterThanOrEqual(1);
        expect(svc.getOrdersByStatus(OrderStatus.CONFIRMED).length).toBeGreaterThanOrEqual(1);
    });
});
