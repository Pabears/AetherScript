import { type OrderItem } from "../entity/order";
import { Customer } from "../entity/customer";
import { OrderService } from "../service/order-service";
import { uuid } from "uuidv4";
import { NotificationService } from "../service/notification-service";
import { ProductService } from "../service/product-service";
import { DB } from "../service/db-service";
import { Order, OrderStatus } from "../entity/order";
import { AutoGen } from "aesc";

export class OrderServiceImpl extends OrderService {
    createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order {
        const orderId = uuid();
        let totalAmount = 0;

        for (const item of items) {
            const product = this.productService?.findProductById(item.productId);
            if (!product || !product.canFulfill(item.quantity)) {
                throw new Error(`Product ${item.productId} is out of stock or does not exist.`);
            }
            totalAmount += product.price * item.quantity;
        }

        const orderItems: OrderItem[] = items.map(item => ({
            ...item,
            unitPrice: this.productService?.findProductById(item.productId)?.price || 0
        }));

        const newOrder = new Order(orderId, customerId, orderItems, OrderStatus.PENDING, new Date(), totalAmount);
        this.db?.saveObject(newOrder.id, newOrder);

        if (this.notificationService) {
            const customer = this.db?.findObject(customerId) as Customer | undefined;
            if (customer) {
                this.notificationService.sendOrderConfirmation(customer, newOrder);
            }
        }

        return newOrder;
    }

    confirmOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || order.status !== OrderStatus.PENDING) {
            throw new Error('Order cannot be confirmed.');
        }

        for (const item of order.items) {
            if (!this.productService?.reduceStock(item.productId, item.quantity)) {
                throw new Error(`Failed to reduce stock for product ${item.productId}.`);
            }
        }

        order.status = OrderStatus.CONFIRMED;
        this.db?.saveObject(orderId, order);

        if (this.notificationService) {
            const customer = this.db?.findObject(order.customerId) as Customer | undefined;
            if (customer) {
                this.notificationService.sendOrderConfirmed(customer, order);
            }
        }

        return true;
    }

    processPayment(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || order.status !== OrderStatus.CONFIRMED) {
            throw new Error('Order cannot be processed for payment.');
        }

        order.status = OrderStatus.PAID;
        this.db?.saveObject(orderId, order);

        if (this.notificationService) {
            const customer = this.db?.findObject(order.customerId) as Customer | undefined;
            if (customer) {
                this.notificationService.sendPaymentConfirmation(customer, order);
            }
        }

        return true;
    }

    cancelOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || ![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
            throw new Error('Order cannot be cancelled.');
        }

        if (order.status === OrderStatus.CONFIRMED) {
            for (const item of order.items) {
                const product = this.productService?.findProductById(item.productId);
                if (product) {
                    product.stock += item.quantity;
                    this.productService?.updateStock(product.id, product.stock);
                }
            }
        }

        order.status = OrderStatus.CANCELLED;
        this.db?.saveObject(orderId, order);

        if (this.notificationService) {
            const customer = this.db?.findObject(order.customerId) as Customer | undefined;
            if (customer) {
                this.notificationService.sendOrderCancellation(customer, order);
            }
        }

        return true;
    }

    findOrderById(orderId: string): Order | undefined {
        return this.db?.findObject(orderId) as Order | undefined;
    }

    findOrdersByCustomer(customerId: string): Order[] {
        const allOrders = this.getAllOrders();
        return allOrders.filter(order => order.customerId === customerId);
    }

    getOrdersByStatus(status: OrderStatus): Order[] {
        const allOrders = this.getAllOrders();
        return allOrders.filter(order => order.status === status);
    }

    getAllOrders(): Order[] {
        const keys = this.db?.getAllKeys() || [];
        return keys.map(key => this.findOrderById(key) as Order).filter(order => !!order);
    }
}