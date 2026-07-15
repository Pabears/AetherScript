import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { NotificationServiceImpl } from '../src/generated/notificationservice.impl';
import { CacheServiceImpl } from '../src/generated/cacheservice.impl';
import { Customer } from '../src/entity/customer';
import { Order, OrderStatus } from '../src/entity/order';

describe('NotificationServiceImpl', () => {
    let notificationService: NotificationServiceImpl;
    let cacheService: CacheServiceImpl;
    let customer: Customer;
    let order: Order;

    beforeEach(() => {
        cacheService = new CacheServiceImpl();
        notificationService = new NotificationServiceImpl();
        notificationService.cacheService = cacheService;

        customer = new Customer('cust-123', 'Alice', 'alice@example.com');
        order = new Order('order-456', 'cust-123', [
            { productId: 'prod-1', quantity: 2, unitPrice: 10 },
            { productId: 'prod-2', quantity: 3, unitPrice: 15 }
        ], OrderStatus.PENDING, new Date(), 65);
    });

    describe('sendOrderConfirmation', () => {
        it('should build message, cache it and return true', async () => {
            const spyLog = spyOn(console, 'log');
            const result = await notificationService.sendOrderConfirmation(customer, order);
            expect(result).toBe(true);

            const expectedMsg = '订单确认 #order-456: 共 2 件商品';
            expect(spyLog).toHaveBeenCalledWith(`[Notification] sendOrderConfirmation → Alice: ${expectedMsg}`);

            const history = await notificationService.getNotificationHistory('cust-123');
            expect(history).toEqual([expectedMsg]);
            spyLog.mockRestore();
        });
    });

    describe('sendOrderConfirmed', () => {
        it('should build message, cache it and return true', async () => {
            const spyLog = spyOn(console, 'log');
            const result = await notificationService.sendOrderConfirmed(customer, order);
            expect(result).toBe(true);

            const expectedMsg = '订单已确认 #order-456: 总金额 65';
            expect(spyLog).toHaveBeenCalledWith(`[Notification] sendOrderConfirmed → Alice: ${expectedMsg}`);

            const history = await notificationService.getNotificationHistory('cust-123');
            expect(history).toEqual([expectedMsg]);
            spyLog.mockRestore();
        });
    });

    describe('sendPaymentConfirmation', () => {
        it('should build message, cache it and return true', async () => {
            const spyLog = spyOn(console, 'log');
            const result = await notificationService.sendPaymentConfirmation(customer, order);
            expect(result).toBe(true);

            const expectedMsg = '支付成功 #order-456: 金额 65';
            expect(spyLog).toHaveBeenCalledWith(`[Notification] sendPaymentConfirmation → Alice: ${expectedMsg}`);

            const history = await notificationService.getNotificationHistory('cust-123');
            expect(history).toEqual([expectedMsg]);
            spyLog.mockRestore();
        });
    });

    describe('sendOrderCancellation', () => {
        it('should build message, cache it and return true', async () => {
            const spyLog = spyOn(console, 'log');
            const result = await notificationService.sendOrderCancellation(customer, order);
            expect(result).toBe(true);

            const expectedMsg = '订单已取消 #order-456';
            expect(spyLog).toHaveBeenCalledWith(`[Notification] sendOrderCancellation → Alice: ${expectedMsg}`);

            const history = await notificationService.getNotificationHistory('cust-123');
            expect(history).toEqual([expectedMsg]);
            spyLog.mockRestore();
        });
    });

    describe('getNotificationHistory', () => {
        it('should return empty array if no notification history exists', async () => {
            const history = await notificationService.getNotificationHistory('cust-999');
            expect(history).toEqual([]);
        });

        it('should return all messages in sequence', async () => {
            await notificationService.sendOrderConfirmation(customer, order);
            await notificationService.sendOrderConfirmed(customer, order);
            await notificationService.sendPaymentConfirmation(customer, order);
            await notificationService.sendOrderCancellation(customer, order);

            const history = await notificationService.getNotificationHistory('cust-123');
            expect(history.length).toBe(4);
            expect(history[0]).toContain('订单确认');
            expect(history[1]).toContain('订单已确认');
            expect(history[2]).toContain('支付成功');
            expect(history[3]).toContain('订单已取消');
        });
    });
});
