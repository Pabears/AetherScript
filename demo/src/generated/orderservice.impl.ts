// Generated from /Users/shiheng/myproject/AetherScript/demo/src/service/order-service.ts
import { OrderService } from '../service/order-service';
import { Order, OrderStatus, type OrderItem } from "../entity/order";
import { DB } from "../service/db-service";
import { ProductService } from "../service/product-service";
import { NotificationService } from "../service/notification-service";
import { uuid } from "uuidv4";

export class OrderServiceImpl extends OrderService {

    public createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order {
        const orderId = uuid();
        const fullItems: OrderItem[] = [];
        let totalAmount = 0;

        for (const item of items) {
            // @ts-ignore
            const product = this.productService?.findProductById(item.productId);
            if (!product) {
                // @ts-ignore
                throw new Error(`Product not found with ID: ${item.productId}`);
            }
            // @ts-ignore
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product: ${product.name}`);
            }

            fullItems.push({
                ...item,
                unitPrice: product.price
            } as OrderItem);

            // @ts-ignore
            totalAmount += product.price * item.quantity;
        }

        const order = new Order(
            orderId,
            customerId,
            fullItems,
            OrderStatus.PENDING,
            new Date(),
            totalAmount
        );

        if (this.db) {
            // @ts-ignore
            this.db.save(order);
        }

        if (this.notificationService) {
            // @ts-ignore
            this.notificationService.sendNotification(customerId, `Order ${orderId} created (PENDING)`);
        }

        return order;
    }

    public confirmOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || order.status !== OrderStatus.PENDING) {
            return false;
        }

        for (const item of order.items) {
            // @ts-ignore
            this.productService?.reduceStock(item.productId, item.quantity);
        }

        order.status = OrderStatus.CONFIRMED;

        if (this.db) {
            // @ts-ignore
            this.db.save(order);
        }

        if (this.notificationService) {
            // @ts-ignore
            this.notificationService.sendNotification(order.customerId, `Order ${orderId} confirmed`);
        }

        return true;
    }

    public processPayment(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || order.status !== OrderStatus.CONFIRMED) {
            return false;
        }

        order.status = OrderStatus.PAID;

        if (this.db) {
            // @ts-ignore
            this.db.save(order);
        }

        if (this.notificationService) {
            // @ts-ignore
            this.notificationService.sendNotification(order.customerId, `Payment processed for order ${orderId}`);
        }

        return true;
    }

    public cancelOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order) {
            return false;
        }

        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
            return false;
        }

        if (order.status === OrderStatus.CONFIRMED && this.productService) {
            for (const item of order.items) {
                // @ts-ignore
                const product = this.productService.findProductById(item.productId);
                if (product) {
                    // @ts-ignore
                    this.productService.updateStock(product.id, product.stock + item.quantity);
                }
            }
        }

        order.status = OrderStatus.CANCELLED;

        if (this.db) {
            // @ts-ignore
            this.db.save(order);
        }

        if (this.notificationService) {
            // @ts-ignore
            this.notificationService.sendNotification(order.customerId, `Order ${orderId} cancelled`);
        }

        return true;
    }

    public findOrderById(orderId: string): Order | undefined {
        if (!this.db) return undefined;
        // @ts-ignore
        return this.db.find(orderId) as Order | undefined;
    }

    public findOrdersByCustomer(customerId: string): Order[] {
        return this.getAllOrders().filter(order => order.customerId === customerId);
    }

    public getOrdersByStatus(status: OrderStatus): Order[] {
        return this.getAllOrders().filter(order => order.status === status);
    }

    public getAllOrders(): Order[] {
        if (!this.db) return [];
        // @ts-ignore
        return (this.db.findAll ? this.db.findAll() : []) as Order[];
    }
}