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
                throw new Error(`Not enough stock for product ${item.productId}`);
            }
            
            orderItems.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price
            });
        }
        
        const totalAmount = orderItems.reduce((total, item) => {
            return total + (item.quantity * item.unitPrice);
        }, 0);
        
        const order = new Order(
            orderId,
            customerId,
            orderItems,
            OrderStatus.PENDING,
            new Date(),
            totalAmount
        );
        
        this.db?.saveObject(`order:${orderId}`, order);
        
        // Send confirmation notification
        const customer = this.db?.findObject(`customer:${customerId}`);
        if (customer) {
            this.notificationService?.sendOrderConfirmation(customer, order);
        }
        
        return order;
    }

    confirmOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || order.status !== OrderStatus.PENDING) {
            return false;
        }
        
        for (const item of order.items) {
            if (!this.productService?.reduceStock(item.productId, item.quantity)) {
                return false;
            }
        }
        
        order.status = OrderStatus.CONFIRMED;
        this.db?.saveObject(`order:${orderId}`, order);
        
        const customer = this.db?.findObject(`customer:${order.customerId}`);
        if (customer) {
            this.notificationService?.sendOrderConfirmed(customer, order);
        }
        
        return true;
    }

    processPayment(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || order.status !== OrderStatus.CONFIRMED) {
            return false;
        }
        
        order.status = OrderStatus.PAID;
        this.db?.saveObject(`order:${orderId}`, order);
        
        const customer = this.db?.findObject(`customer:${order.customerId}`);
        if (customer) {
            this.notificationService?.sendPaymentConfirmation(customer, order);
        }
        
        return true;
    }

    cancelOrder(orderId: string): boolean {
        const order = this.findOrderById(orderId);
        if (!order || (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED)) {
            return false;
        }
        
        if (order.status === OrderStatus.CONFIRMED) {
            for (const item of order.items) {
                this.productService?.updateStock(item.productId, item.quantity);
            }
        }
        
        order.status = OrderStatus.CANCELLED;
        this.db?.saveObject(`order:${orderId}`, order);
        
        const customer = this.db?.findObject(`customer:${order.customerId}`);
        if (customer) {
            this.notificationService?.sendOrderCancellation(customer, order);
        }
        
        return true;
    }

    findOrderById(orderId: string): Order | undefined {
        return this.db?.findObject(`order:${orderId}`);
    }

    findOrdersByCustomer(customerId: string): Order[] {
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys
            .filter(key => key.startsWith('order:'))
            .map(key => this.db?.findObject(key))
            .filter(order => order && order.customerId === customerId) as Order[];
    }

    getOrdersByStatus(status: OrderStatus): Order[] {
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys
            .filter(key => key.startsWith('order:'))
            .map(key => this.db?.findObject(key))
            .filter(order => order && order.status === status) as Order[];
    }

    getAllOrders(): Order[] {
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys
            .filter(key => key.startsWith('order:'))
            .map(key => this.db?.findObject(key))
            .filter(order => order !== undefined) as Order[];
    }
}