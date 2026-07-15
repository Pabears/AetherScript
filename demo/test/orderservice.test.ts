import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { OrderServiceImpl } from '../src/generated/orderservice.impl';
import { DBImpl } from '../src/generated/db.impl';
import { ProductServiceImpl } from '../src/generated/productservice.impl';
import { NotificationServiceImpl } from '../src/generated/notificationservice.impl';
import { CustomerServiceImpl } from '../src/generated/customerservice.impl';
import { CacheServiceImpl } from '../src/generated/cacheservice.impl';
import { Order, OrderStatus } from '../src/entity/order';
import { Product } from '../src/entity/product';
import { Customer } from '../src/entity/customer';

describe('OrderServiceImpl', () => {
    let orderService: OrderServiceImpl;
    let db: DBImpl;
    let productService: ProductServiceImpl;
    let notificationService: NotificationServiceImpl;
    let customerService: CustomerServiceImpl;
    let cacheService: CacheServiceImpl;

    let customer: Customer;
    let product1: Product;
    let product2: Product;

    beforeEach(() => {
        db = new DBImpl();
        productService = new ProductServiceImpl();
        productService.db = db;

        cacheService = new CacheServiceImpl();
        notificationService = new NotificationServiceImpl();
        notificationService.cacheService = cacheService;

        customerService = new CustomerServiceImpl();
        customerService.db = db;

        orderService = new OrderServiceImpl();
        orderService.db = db;
        orderService.productService = productService;
        orderService.notificationService = notificationService;
        orderService.customerService = customerService;

        // Create standard test data
        customer = customerService.createCustomer('Alice', 'alice@example.com');
        product1 = productService.createProduct('Phone', 500, 10, 'Electronics');
        product2 = productService.createProduct('Case', 20, 5, 'Accessories');
    });

    describe('createOrder', () => {
        it('should create order successfully and send notification when customer exists', () => {
            const spySend = spyOn(notificationService, 'sendOrderConfirmation');
            const items = [
                { productId: product1.id, quantity: 2 },
                { productId: product2.id, quantity: 3 }
            ];

            const order = orderService.createOrder(customer.id, items);
            expect(order).toBeInstanceOf(Order);
            expect(order.id).toBeDefined();
            expect(order.customerId).toBe(customer.id);
            expect(order.status).toBe(OrderStatus.PENDING);
            expect(order.totalAmount).toBe(2 * 500 + 3 * 20); // 1060
            expect(order.items.length).toBe(2);
            expect(order.items[0].unitPrice).toBe(500);
            expect(order.items[1].unitPrice).toBe(20);

            // Stored in DB
            const savedOrder = db.findObject('order:' + order.id);
            expect(savedOrder).toBe(order);

            // Notification sent
            expect(spySend).toHaveBeenCalledWith(customer, order);
            spySend.mockRestore();
        });

        it('should throw error if product does not exist', () => {
            expect(() => {
                orderService.createOrder(customer.id, [
                    { productId: 'non-existent', quantity: 1 }
                ]);
            }).toThrow('Product with ID non-existent not found.');
        });

        it('should throw error if stock is insufficient', () => {
            expect(() => {
                orderService.createOrder(customer.id, [
                    { productId: product1.id, quantity: 11 } // stock is 10
                ]);
            }).toThrow(`Insufficient stock for product ${product1.id}.`);
        });
    });

    describe('confirmOrder', () => {
        it('should confirm order, reduce stock, and notify customer', async () => {
            const spySend = spyOn(notificationService, 'sendOrderConfirmed');
            const items = [
                { productId: product1.id, quantity: 2 },
                { productId: product2.id, quantity: 3 }
            ];
            const order = orderService.createOrder(customer.id, items);

            const result = await orderService.confirmOrder(order.id);
            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.CONFIRMED);

            // Stock reduced
            const savedProd1 = productService.findProductById(product1.id);
            const savedProd2 = productService.findProductById(product2.id);
            expect(savedProd1?.stock).toBe(8);
            expect(savedProd2?.stock).toBe(2);

            // Notification sent
            expect(spySend).toHaveBeenCalledWith(customer, order);
            spySend.mockRestore();
        });

        it('should return false if order does not exist', async () => {
            const result = await orderService.confirmOrder('non-existent');
            expect(result).toBe(false);
        });

        it('should return false if order status is not PENDING', async () => {
            const order = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 1 }]);
            await orderService.confirmOrder(order.id); // now CONFIRMED

            const result = await orderService.confirmOrder(order.id);
            expect(result).toBe(false);
        });

        it('should return false if reduceStock fails (e.g. stock level dropped below order level)', async () => {
            const order = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 10 }]);
            // Manually reduce stock before confirming the order
            productService.updateStock(product1.id, 5);

            const result = await orderService.confirmOrder(order.id);
            expect(result).toBe(false);
            expect(order.status).toBe(OrderStatus.PENDING); // remains PENDING
        });
    });

    describe('processPayment', () => {
        it('should pay for confirmed order and notify customer', async () => {
            const spySend = spyOn(notificationService, 'sendPaymentConfirmation');
            const order = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 1 }]);
            await orderService.confirmOrder(order.id);

            const result = await orderService.processPayment(order.id);
            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.PAID);

            expect(spySend).toHaveBeenCalledWith(customer, order);
            spySend.mockRestore();
        });

        it('should return false if order does not exist', async () => {
            const result = await orderService.processPayment('non-existent');
            expect(result).toBe(false);
        });

        it('should return false if order status is not CONFIRMED', async () => {
            const order = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 1 }]);
            // order is PENDING right now

            const result = await orderService.processPayment(order.id);
            expect(result).toBe(false);
        });
    });

    describe('cancelOrder', () => {
        it('should cancel PENDING order without restoring stock and notify customer', async () => {
            const spySend = spyOn(notificationService, 'sendOrderCancellation');
            const order = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 2 }]);

            const result = await orderService.cancelOrder(order.id);
            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.CANCELLED);

            // Stock unchanged because it was never reduced
            const savedProd = productService.findProductById(product1.id);
            expect(savedProd?.stock).toBe(10);

            expect(spySend).toHaveBeenCalledWith(customer, order);
            spySend.mockRestore();
        });

        it('should cancel CONFIRMED order, restore stock, and notify customer', async () => {
            const spySend = spyOn(notificationService, 'sendOrderCancellation');
            const order = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 2 }]);
            await orderService.confirmOrder(order.id); // stock is now 8

            const result = await orderService.cancelOrder(order.id);
            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.CANCELLED);

            // Stock restored back to 10
            const savedProd = productService.findProductById(product1.id);
            expect(savedProd?.stock).toBe(10);

            expect(spySend).toHaveBeenCalledWith(customer, order);
            spySend.mockRestore();
        });

        it('should return false if order does not exist', async () => {
            const result = await orderService.cancelOrder('non-existent');
            expect(result).toBe(false);
        });

        it('should return false if order is already PAID or CANCELLED', async () => {
            const order = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 1 }]);
            await orderService.confirmOrder(order.id);
            await orderService.processPayment(order.id); // now PAID

            const result = await orderService.cancelOrder(order.id);
            expect(result).toBe(false);
        });
    });

    describe('queries', () => {
        let order1: Order;
        let order2: Order;
        let order3: Order;

        beforeEach(async () => {
            order1 = orderService.createOrder(customer.id, [{ productId: product1.id, quantity: 1 }]);
            order2 = orderService.createOrder(customer.id, [{ productId: product2.id, quantity: 1 }]);
            order3 = orderService.createOrder('other-customer', [{ productId: product1.id, quantity: 1 }]);

            await orderService.confirmOrder(order1.id);
        });

        it('should findOrderById', () => {
            expect(orderService.findOrderById(order1.id)).toBe(order1);
            expect(orderService.findOrderById('non-existent')).toBeUndefined();
        });

        it('should findOrdersByCustomer', () => {
            const orders = orderService.findOrdersByCustomer(customer.id);
            expect(orders).toContain(order1);
            expect(orders).toContain(order2);
            expect(orders).not.toContain(order3);
            expect(orders.length).toBe(2);
        });

        it('should getOrdersByStatus', () => {
            const confirmed = orderService.getOrdersByStatus(OrderStatus.CONFIRMED);
            expect(confirmed).toContain(order1);
            expect(confirmed.length).toBe(1);

            const pending = orderService.getOrdersByStatus(OrderStatus.PENDING);
            expect(pending).toContain(order2);
            expect(pending).toContain(order3);
            expect(pending.length).toBe(2);
        });

        it('should getAllOrders', () => {
            const all = orderService.getAllOrders();
            expect(all).toContain(order1);
            expect(all).toContain(order2);
            expect(all).toContain(order3);
            expect(all.length).toBe(3);
        });
    });
});
