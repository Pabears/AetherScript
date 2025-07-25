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
        let totalAmount = 0;
        const orderItems: OrderItem[] = [];

        for (const item of items) {
            const product = this.productService?.findProductById(item.productId);
            if (!product || !product.canFulfill(item.quantity)) {
                throw new Error(`Product ${item.productId} is out of stock or does not exist.`);
            }
            orderItems.push({ ...item, unitPrice: product.price });
            totalAmount += product.price * item.quantity;
        }

        const order = new Order(orderId, customerId, orderItems, OrderStatus.PENDING, new Date(), totalAmount);
        this.db?.saveObject(orderId, order);

        const customer = this.db?.findObject(customerId) as Customer | undefined;
        if (customer) {
            this.notificationService?.sendOrderConfirmation(customer, order);
        }

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

        const customer = this.db?.findObject(order.customerId) as Customer | undefined;
        if (customer) {
            this.notificationService?.sendOrderConfirmed(customer, order);
        }

        return true;
    }

    public processPayment(orderId: string): boolean {
        const order = this.db?.findObject(orderId) as Order | undefined;
        if (!order || order.status !== OrderStatus.CONFIRMED) {
            return false;
        }

        order.status = OrderStatus.PAID;
        this.db?.saveObject(orderId, order);

        const customer = this.db?.findObject(order.customerId) as Customer | undefined;
        if (customer) {
            this.notificationService?.sendPaymentConfirmation(customer, order);
        }

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
                    this.productService?.updateStock(product.id, product.stock);
                }
            }
        }

        order.status = OrderStatus.CANCELLED;
        this.db?.saveObject(orderId, order);

        const customer = this.db?.findObject(order.customerId) as Customer | undefined;
        if (customer) {
            this.notificationService?.sendOrderCancellation(customer, order);
        }

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
        return keys.map(key => this.db?.findObject(key) as Order).filter(order => order instanceof Order);
    }
}