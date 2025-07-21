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
    public createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order {
        const orderId = uuid();
        const orderItems: OrderItem[] = [];

        for (const item of items) {
            const product = this.productService?.findProductById(item.productId);
            if (!product || !product.canFulfill(item.quantity)) {
                throw new Error(`Product ${item.productId} is not available or insufficient stock.`);
            }
            orderItems.push({ ...item, unitPrice: product.price });
        }

        const totalAmount = orderItems.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
        const order = new Order(orderId, customerId, orderItems, OrderStatus.PENDING, new Date(), totalAmount);

        this.db?.saveObject(orderId, order);
        this.notificationService?.sendOrderConfirmation(new Customer(customerId, '', ''), order);

        return order;
    }

    public confirmOrder(orderId: string): boolean {
        const order = this.db?.findObject(orderId) as Order | undefined;
        if (!order || order.status !== OrderStatus.PENDING) {
            return false;
        }

        for (const item of order.items) {
            if (!this.productService?.reduceStock(item.productId, item.quantity)) {
                return false;
            }
        }

        order.status = OrderStatus.CONFIRMED;
        this.db?.saveObject(orderId, order);
        this.notificationService?.sendOrderConfirmed(new Customer(order.customerId, '', ''), order);

        return true;
    }

    public processPayment(orderId: string): boolean {
        const order = this.db?.findObject(orderId) as Order | undefined;
        if (!order || order.status !== OrderStatus.CONFIRMED) {
            return false;
        }

        order.status = OrderStatus.PAID;
        this.db?.saveObject(orderId, order);
        this.notificationService?.sendPaymentConfirmation(new Customer(order.customerId, '', ''), order);

        return true;
    }

    public cancelOrder(orderId: string): boolean {
        const order = this.db?.findObject(orderId) as Order | undefined;
        if (!order || ![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
            return false;
        }

        if (order.status === OrderStatus.CONFIRMED) {
            for (const item of order.items) {
                const product = this.productService?.findProductById(item.productId);
                if (product) {
                    product.stock += item.quantity;
                    this.productService?.updateStock(item.productId, product.stock);
                }
            }
        }

        order.status = OrderStatus.CANCELLED;
        this.db?.saveObject(orderId, order);
        this.notificationService?.sendOrderCancellation(new Customer(order.customerId, '', ''), order);

        return true;
    }

    public findOrderById(orderId: string): Order | undefined {
        return this.db?.findObject(orderId) as Order | undefined;
    }

    public findOrdersByCustomer(customerId: string): Order[] {
        const allOrders = this.getAllOrders();
        return allOrders.filter(order => order.customerId === customerId);
    }

    public getOrdersByStatus(status: OrderStatus): Order[] {
        const allOrders = this.getAllOrders();
        return allOrders.filter(order => order.status === status);
    }

    public getAllOrders(): Order[] {
        const keys = this.db?.getAllKeys() || [];
        return keys.map(key => this.db?.findObject(key) as Order).filter(order => order !== undefined);
    }
}