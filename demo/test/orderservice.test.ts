import { describe, it, expect, beforeEach } from "bun:test";
import { OrderServiceImpl } from "../src/generated/orderservice.impl";
import { Order, OrderStatus, type OrderItem } from "../src/entity/order";

describe("OrderServiceImpl", () => {
    let orderService: OrderServiceImpl;
    let mockDb: any;
    let mockProductService: any;
    let mockNotificationService: any;

    beforeEach(() => {
        mockDb = {
            store: new Map<string, any>(),
            save(item: any) {
                // Handle possible property names for ID
                const id = item.id || item.orderId;
                if (id) {
                    this.store.set(id, item);
                } else {
                    // Fallback for mock if id property isn't directly exposed
                    this.store.set(item, item);
                }
            },
            find(id: string) {
                return this.store.get(id);
            },
            findAll() {
                return Array.from(this.store.values());
            }
        };

        mockProductService = {
            products: new Map<string, any>(),
            findProductById(id: string) {
                return this.products.get(id);
            },
            reduceStock(id: string, quantity: number) {
                const product = this.products.get(id);
                if (product) product.stock -= quantity;
            },
            updateStock(id: string, stock: number) {
                const product = this.products.get(id);
                if (product) product.stock = stock;
            }
        };

        mockNotificationService = {
            notifications: [],
            sendNotification(customerId: string, message: string) {
                this.notifications.push({ customerId, message });
            }
        };

        orderService = new OrderServiceImpl();
        // Inject mocks
        (orderService as any).db = mockDb;
        (orderService as any).productService = mockProductService;
        (orderService as any).notificationService = mockNotificationService;
    });

    describe("createOrder", () => {
        it("should create an order successfully with correct total and stock check", () => {
            mockProductService.products.set("p1", { id: "p1", name: "Product 1", price: 100, stock: 10 });
            mockProductService.products.set("p2", { id: "p2", name: "Product 2", price: 50, stock: 5 });

            const items = [
                { productId: "p1", quantity: 2 },
                { productId: "p2", quantity: 1 }
            ];

            const order = orderService.createOrder("c1", items);

            expect(order).toBeDefined();
            expect(order.customerId).toBe("c1");
            expect(order.totalAmount).toBe(250); // 2*100 + 1*50
            expect(order.status).toBe(OrderStatus.PENDING);
            expect(order.items.length).toBe(2);
            expect(order.items[0].unitPrice).toBe(100);
            expect(order.items[1].unitPrice).toBe(50);

            // Check if saved to DB
            const savedOrder = mockDb.find((order as any).id || (order as any).orderId);
            expect(savedOrder).toBeDefined();

            // Check notifications
            expect(mockNotificationService.notifications.length).toBe(1);
            expect(mockNotificationService.notifications[0].customerId).toBe("c1");
            expect(mockNotificationService.notifications[0].message).toContain("created"); // based on case-insensitive or exact check if needed
        });

        it("should throw error if a product is not found", () => {
            const items = [{ productId: "unknown", quantity: 1 }];
            expect(() => orderService.createOrder("c1", items)).toThrow("Product not found");
        });

        it("should throw error if insufficient stock for a product", () => {
            mockProductService.products.set("p1", { id: "p1", name: "Product 1", price: 100, stock: 1 });
            const items = [{ productId: "p1", quantity: 2 }];
            expect(() => orderService.createOrder("c1", items)).toThrow("Insufficient stock");
        });
    });

    describe("confirmOrder", () => {
        it("should confirm a PENDING order, reduce stock, and notify customer", () => {
            mockProductService.products.set("p1", { id: "p1", name: "Product 1", price: 100, stock: 10 });
            const order = new Order("o1", "c1", [{ productId: "p1", quantity: 2, unitPrice: 100 }] as any, OrderStatus.PENDING, new Date(), 200);
            // manually set property for mock db mapping
            (order as any).id = "o1";
            mockDb.save(order);

            const result = orderService.confirmOrder("o1");

            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.CONFIRMED);
            expect(mockProductService.products.get("p1").stock).toBe(8); // Reduced by 2

            const notification = mockNotificationService.notifications.find((n: any) => n.customerId === "c1");
            expect(notification).toBeDefined();
            expect(notification.message).toContain("confirmed");
        });

        it("should return false if order does not exist", () => {
            expect(orderService.confirmOrder("nonexistent")).toBe(false);
        });

        it("should return false if order is not in PENDING status", () => {
            const order = new Order("o1", "c1", [], OrderStatus.CONFIRMED, new Date(), 0);
            (order as any).id = "o1";
            mockDb.save(order);
            expect(orderService.confirmOrder("o1")).toBe(false);
        });
    });

    describe("processPayment", () => {
        it("should process payment for a CONFIRMED order and update status to PAID", () => {
            const order = new Order("o1", "c1", [], OrderStatus.CONFIRMED, new Date(), 0);
            (order as any).id = "o1";
            mockDb.save(order);

            const result = orderService.processPayment("o1");

            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.PAID);
        });

        it("should return false if order is not CONFIRMED", () => {
            const order = new Order("o1", "c1", [], OrderStatus.PENDING, new Date(), 0);
            (order as any).id = "o1";
            mockDb.save(order);
            expect(orderService.processPayment("o1")).toBe(false);
        });
    });

    describe("cancelOrder", () => {
        it("should cancel a PENDING order without modifying product stock", () => {
            mockProductService.products.set("p1", { id: "p1", name: "Product 1", price: 100, stock: 10 });
            const order = new Order("o1", "c1", [{ productId: "p1", quantity: 2 }] as any, OrderStatus.PENDING, new Date(), 200);
            (order as any).id = "o1";
            mockDb.save(order);

            const result = orderService.cancelOrder("o1");

            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.CANCELLED);
            expect(mockProductService.products.get("p1").stock).toBe(10); // Stock shouldn't change for PENDING
        });

        it("should cancel a CONFIRMED order and restore product stock", () => {
            mockProductService.products.set("p1", { id: "p1", name: "Product 1", price: 100, stock: 8 }); // Assuming stock was already reduced
            const order = new Order("o1", "c1", [{ productId: "p1", quantity: 2 }] as any, OrderStatus.CONFIRMED, new Date(), 200);
            (order as any).id = "o1";
            mockDb.save(order);

            const result = orderService.cancelOrder("o1");

            expect(result).toBe(true);
            expect(order.status).toBe(OrderStatus.CANCELLED);
            expect(mockProductService.products.get("p1").stock).toBe(10); // Stock should be restored
        });

        it("should return false if order is not PENDING or CONFIRMED", () => {
            const order = new Order("o1", "c1", [], OrderStatus.PAID, new Date(), 0);
            (order as any).id = "o1";
            mockDb.save(order);
            expect(orderService.cancelOrder("o1")).toBe(false);
        });

        it("should return false if order does not exist", () => {
            expect(orderService.cancelOrder("nonexistent")).toBe(false);
        });
    });

    describe("Query Methods", () => {
        beforeEach(() => {
            const o1 = new Order("o1", "c1", [], OrderStatus.PENDING, new Date(), 100);
            (o1 as any).id = "o1";
            const o2 = new Order("o2", "c1", [], OrderStatus.CONFIRMED, new Date(), 200);
            (o2 as any).id = "o2";
            const o3 = new Order("o3", "c2", [], OrderStatus.PAID, new Date(), 300);
            (o3 as any).id = "o3";

            mockDb.save(o1);
            mockDb.save(o2);
            mockDb.save(o3);
        });

        it("findOrderById should return correct order", () => {
            const order = orderService.findOrderById("o1");
            expect(order).toBeDefined();
            expect(order?.customerId).toBe("c1");
        });

        it("findOrderById should return undefined for nonexistent order", () => {
            const order = orderService.findOrderById("invalid");
            expect(order).toBeUndefined();
        });

        it("findOrdersByCustomer should return array of customer's orders", () => {
            const orders = orderService.findOrdersByCustomer("c1");
            expect(orders.length).toBe(2);
            expect(orders.every(o => o.customerId === "c1")).toBe(true);
        });

        it("getOrdersByStatus should filter orders correctly", () => {
            const orders = orderService.getOrdersByStatus(OrderStatus.CONFIRMED);
            expect(orders.length).toBe(1);
            expect(orders[0].status).toBe(OrderStatus.CONFIRMED);
        });

        it("getAllOrders should return all orders", () => {
            const orders = orderService.getAllOrders();
            expect(orders.length).toBe(3);
        });
    });

    describe("Dependency Handling", () => {
        it("should handle missing optional dependencies safely", () => {
            const serviceWithoutDeps = new OrderServiceImpl();

            // It shouldn't crash on query operations
            expect(serviceWithoutDeps.findOrderById("o1")).toBeUndefined();
            expect(serviceWithoutDeps.getAllOrders()).toEqual([]);
        });
    });
});