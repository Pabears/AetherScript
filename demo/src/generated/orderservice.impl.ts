import { OrderService } from '../service/order-service';
import { Order, OrderStatus, type OrderItem } from '../entity/order';

export class OrderServiceImpl extends OrderService {
    public createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order {
        // 1. 生成 orderId
        const orderId = crypto.randomUUID();
        // 2. 验证每个 item 商品存在，3. 检查库存
        const fullItems: OrderItem[] = [];
        for (const item of items) {
            const product = this.productService!.findProductById(item.productId);
            if (!product) throw new Error(`Product not found: ${item.productId}`);
            if (product.stock < item.quantity) throw new Error(`Insufficient stock for product: ${product.name}`);
            fullItems.push({ ...item, unitPrice: product.price });
        }
        // 4. 计算总金额，5. 创建 Order
        const totalAmount = fullItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        const order = new Order(orderId, customerId, fullItems, OrderStatus.PENDING, new Date(), totalAmount);
        // 6. 保存
        this.db!.saveObject('order:' + orderId, order);
        // 7. 发送通知
        const customer = this.customerService!.findCustomerById(customerId);
        if (customer) {
            this.notificationService!.sendOrderConfirmation(customer, order);
        }
        // 8. 返回
        return order;
    }

    public async confirmOrder(orderId: string): Promise<boolean> {
        // 1. 找到订单
        const order: Order | undefined = this.db!.findObject('order:' + orderId);
        if (!order) return false;
        // 2. 检查状态
        if (order.status !== OrderStatus.PENDING) return false;
        // 3. 减少库存
        for (const item of order.items) {
            this.productService!.reduceStock(item.productId, item.quantity);
        }
        // 4. 更新状态
        order.status = OrderStatus.CONFIRMED;
        // 5. 保存
        this.db!.saveObject('order:' + orderId, order);
        // 6. 发送通知
        const customer = this.customerService!.findCustomerById(order.customerId);
        if (customer) {
            await this.notificationService!.sendOrderConfirmed(customer, order);
        }
        return true;
    }

    public async processPayment(orderId: string): Promise<boolean> {
        const order: Order | undefined = this.db!.findObject('order:' + orderId);
        if (!order) return false;
        if (order.status !== OrderStatus.CONFIRMED) return false;
        order.status = OrderStatus.PAID;
        this.db!.saveObject('order:' + orderId, order);
        const customer = this.customerService!.findCustomerById(order.customerId);
        if (customer) {
            await this.notificationService!.sendPaymentConfirmation(customer, order);
        }
        return true;
    }

    public async cancelOrder(orderId: string): Promise<boolean> {
        const order: Order | undefined = this.db!.findObject('order:' + orderId);
        if (!order) return false;
        // 只有 PENDING 或 CONFIRMED 可取消
        if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) return false;
        // CONFIRMED 状态需恢复库存
        if (order.status === OrderStatus.CONFIRMED) {
            for (const item of order.items) {
                const product = this.productService!.findProductById(item.productId);
                if (product) {
                    this.productService!.updateStock(item.productId, product.stock + item.quantity);
                }
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

    public findOrderById(orderId: string): Order | undefined {
        return this.db!.findObject('order:' + orderId);
    }

    public findOrdersByCustomer(customerId: string): Order[] {
        return this.getAllOrders().filter(o => o.customerId === customerId);
    }

    public getOrdersByStatus(status: OrderStatus): Order[] {
        return this.getAllOrders().filter(o => o.status === status);
    }

    public getAllOrders(): Order[] {
        return this.db!.getAllKeys()
            .filter(k => k.startsWith('order:'))
            .map(k => this.db!.findObject(k))
            .filter((o): o is Order => o !== undefined);
    }
}
