import { type OrderItem } from "../entity/order";
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
        const orderItems: OrderItem[] = [];
        
        for (const item of items) {
            const product = this.productService?.findProductById(item.productId);
            if (!product) {
                throw new Error(`Product with ID ${item.productId} not found`);
            }
            
            if (!product.canFulfill(item.quantity)) {
                throw new Error(`Insufficient stock for product ${item.productId}`);
            }
            
            orderItems.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price
            });
        }
        
        const order = new Order(
            orderId,
            customerId,
            orderItems,
            OrderStatus.PENDING
        );
        
        order.totalAmount = order.calculateTotal();
        
        this.db?.saveObject(`order:${orderId}`, order);
        
        // Simulate sending notification
        // In real implementation, we would call this.notificationService?.sendOrderConfirmation()
        
        return order;
    }

    confirmOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order) {
            return false;
        }
        
        if (order.status !== OrderStatus.PENDING) {
            return false;
        }
        
        for (const item of order.items) {
            this.productService?.reduceStock(item.productId, item.quantity);
        }
        
        order.status = OrderStatus.CONFIRMED;
        this.db?.saveObject(`order:${orderId}`, order);
        
        // Simulate sending notification
        // In real implementation, we would call this.notificationService?.sendOrderConfirmed()
        
        return true;
    }

    processPayment(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order) {
            return false;
        }
        
        if (order.status !== OrderStatus.CONFIRMED) {
            return false;
        }
        
        order.status = OrderStatus.PAID;
        this.db?.saveObject(`order:${orderId}`, order);
        
        // Simulate sending notification
        // In real implementation, we would call this.notificationService?.sendPaymentConfirmation()
        
        return true;
    }

    cancelOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order) {
            return false;
        }
        
        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
            return false;
        }
        
        if (order.status === OrderStatus.CONFIRMED) {
            for (const item of order.items) {
                this.productService?.updateStock(item.productId, item.quantity);
            }
        }
        
        order.status = OrderStatus.CANCELLED;
        this.db?.saveObject(`order:${orderId}`, order);
        
        // Simulate sending notification
        // In real implementation, we would call this.notificationService?.sendOrderCancellation()
        
        return true;
    }

    findOrderById(orderId: string): Order | undefined {
        return this.db?.findObject(`order:${orderId}`) as Order;
    }

    findOrdersByCustomer(customerId: string): Order[] {
        const allKeys = this.db?.getAllKeys() || [];
        const customerOrders: Order[] = [];
        
        for (const key of allKeys) {
            if (key.startsWith('order:')) {
                const order = this.db?.findObject(key) as Order;
                if (order && order.customerId === customerId) {
                    customerOrders.push(order);
                }
            }
        }
        
        return customerOrders;
    }

    getOrdersByStatus(status: OrderStatus): Order[] {
        const allKeys = this.db?.getAllKeys() || [];
        const statusOrders: Order[] = [];
        
        for (const key of allKeys) {
            if (key.startsWith('order:')) {
                const order = this.db?.findObject(key) as Order;
                if (order && order.status === status) {
                    statusOrders.push(order);
                }
            }
        }
        
        return statusOrders;
    }

    getAllOrders(): Order[] {
        const allKeys = this.db?.getAllKeys() || [];
        const allOrders: Order[] = [];
        
        for (const key of allKeys) {
            if (key.startsWith('order:')) {
                const order = this.db?.findObject(key) as Order;
                if (order) {
                    allOrders.push(order);
                }
            }
        }
        
        return allOrders;
    }
}