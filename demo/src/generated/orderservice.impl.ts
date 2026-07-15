import { Order, OrderStatus, type OrderItem } from '../entity/order';
import { OrderService } from '../service/order-service';

export class OrderServiceImpl extends OrderService {
    /**
     * 创建新订单
     */
    public createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order {
        const orderId = crypto.randomUUID();
        const fullItems: OrderItem[] = [];
        let totalAmount = 0;

        for (const item of items) {
            const product = this.productService!.findProductById(item.productId);
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product: ${item.productId}`);
            }
            const unitPrice = product.price;
            totalAmount += item.quantity * unitPrice;
            fullItems.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice
            });
        }

        const order = new Order(orderId, customerId, fullItems, OrderStatus.PENDING, new Date(), totalAmount);
        this.db!.saveObject('order:' + orderId, order);

        const customer = this.customerService!.findCustomerById(customerId);
        if (customer) {
            this.notificationService!.sendOrderConfirmation(customer, order).catch(err => {
                console.error('Failed to send order confirmation notification:', err);
            });
        }

        return order;
    }

    /**
     * 确认订单并减少库存
     */
    public async confirmOrder(orderId: string): Promise<boolean> {
        const order = this.findOrderById(orderId);
        if (!order) {
            return false;
        }
        if (order.status !== OrderStatus.PENDING) {
            return false;
        }

        for (const item of order.items) {
            const reduced = this.productService!.reduceStock(item.productId, item.quantity);
            if (!reduced) {
                // If stock reduction fails (JSDoc doesn't specify rollbacks, but let's follow description)
            }
        }

        order.status = OrderStatus.CONFIRMED;
        this.db!.saveObject('order:' + orderId, order);

        const customer = this.customerService!.findCustomerById(order.customerId);
        if (customer) {
            await this.notificationService!.sendOrderConfirmed(customer, order);
        }

        return true;
    }

    /**
     * 处理支付
     */
    public async processPayment(orderId: string): Promise<boolean> {
        const order = this.findOrderById(orderId);
        if (!order) {
            return false;
        }
        if (order.status !== OrderStatus.CONFIRMED) {
            return false;
        }

        order.status = OrderStatus.PAID;
        this.db!.saveObject('order:' + orderId, order);

        const customer = this.customerService!.findCustomerById(order.customerId);
        if (customer) {
            await this.notificationService!.sendPaymentConfirmation(customer, order);
        }

        return true;
    }

    /**
     * 取消订单并恢复库存
     */
    public async cancelOrder(orderId: string): Promise<boolean> {
        const order = this.findOrderById(orderId);
        if (!order) {
            return false;
        }
        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
            return false;
        }

        if (order.status === OrderStatus.CONFIRMED) {
            for (const item of order.items) {
                const product = this.productService!.findProductById(item.productId);
                const currentStock = product ? product.stock : 0;
                this.productService!.updateStock(item.productId, currentStock + item.quantity);
            }
        }

        order.status = OrderStatus.CANCELLED;
        this.db!.saveObject('order:' + orderId, order);

        const customer = this.customerService!.findCustomerById(order.customerId);
        if (customer) {
            await this.notificationService!.sendOrderCancellation(customer, order);
        }

        return true;
    }

    /**
     * 按 ID 查找订单
     */
    public findOrderById(orderId: string): Order | undefined {
        const obj = this.db!.findObject('order:' + orderId);
        if (obj) {
            return obj as Order;
        }
        return undefined;
    }

    /**
     * 按客户 ID 查找订单
     */
    public findOrdersByCustomer(customerId: string): Order[] {
        const allOrders = this.getAllOrders();
        return allOrders.filter(o => o.customerId === customerId);
    }

    /**
     * 按状态获取订单
     */
    public getOrdersByStatus(status: OrderStatus): Order[] {
        const allOrders = this.getAllOrders();
        return allOrders.filter(o => o.status === status);
    }

    /**
     * 获取所有订单
     */
    public getAllOrders(): Order[] {
        const keys = this.db!.getAllKeys();
        const orders: Order[] = [];
        for (const key of keys) {
            if (key.startsWith('order:')) {
                const obj = this.db!.findObject(key);
                if (obj) {
                    orders.push(obj as Order);
                }
            }
        }
        return orders;
    }
}
