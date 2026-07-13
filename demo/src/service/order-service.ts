import { Order, OrderStatus, type OrderItem } from '../entity/order';
import { DB } from './db-service';
import { ProductService } from './product-service';
import { NotificationService } from './notification-service';
import { CustomerService } from './customer-service';

// @autogen
/**
 * OrderService — 订单管理服务（核心业务流程）
 *
 * 架构约束：
 * - 依赖 DB、ProductService、NotificationService、CustomerService（@AutoGen 注入）
 * - 订单 key 格式：'order:' + orderId
 * - 使用 crypto.randomUUID() 生成订单 ID
 */
export abstract class OrderService {
    // @AutoGen
    public db?: DB;

    // @AutoGen
    public productService?: ProductService;

    // @AutoGen
    public notificationService?: NotificationService;

    // @AutoGen
    public customerService?: CustomerService;

    /**
     * 创建新订单
     *
     * @description
     * 1. 使用 crypto.randomUUID() 生成 orderId
     * 2. 验证每个 item：调用 productService!.findProductById(item.productId)，找不到抛出错误
     * 3. 检查每个 item 库存充足：product.stock >= item.quantity，不足抛出错误
     * 4. 构建完整 OrderItem 数组（补全 unitPrice = product.price）
     * 5. 计算 totalAmount = 所有 item 的 quantity * unitPrice 之和
     * 6. 创建 Order 对象（status = PENDING）
     * 7. 调用 db!.saveObject('order:' + orderId, order) 保存
     * 8. 查找客户（customerService!.findCustomerById(customerId)），若找到则发送通知
     * 9. 返回 Order 对象
     *
     * @param customerId - 客户 ID
     * @param items - 订单项（不含 unitPrice，由 productService 填充）
     * @returns 创建的 Order 对象
     * @throws Error 如果商品不存在
     * @throws Error 如果库存不足
     */
    public abstract createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order;

    /**
     * 确认订单并减少库存
     *
     * @description
     * 1. 找到订单（db!.findObject('order:' + orderId)），找不到返回 false
     * 2. 检查 order.status === PENDING，否则返回 false
     * 3. 对每个 item 调用 productService!.reduceStock(item.productId, item.quantity)
     * 4. 更新 order.status = CONFIRMED
     * 5. 调用 db!.saveObject('order:' + orderId, order) 保存
     * 6. 查找客户，若找到则调用 notificationService!.sendOrderConfirmed(customer, order)
     * 7. 返回 true
     *
     * @param orderId - 订单 ID
     * @returns 成功返回 true，订单不存在或状态不符返回 false
     */
    public abstract confirmOrder(orderId: string): Promise<boolean>;

    /**
     * 处理支付
     *
     * @description
     * 1. 找到订单，找不到返回 false
     * 2. 检查 order.status === CONFIRMED，否则返回 false
     * 3. 更新 order.status = PAID
     * 4. 保存订单
     * 5. 查找客户，若找到则调用 notificationService!.sendPaymentConfirmation(customer, order)
     * 6. 返回 true
     *
     * @param orderId - 订单 ID
     * @returns 成功返回 true，订单不存在或状态不符返回 false
     */
    public abstract processPayment(orderId: string): Promise<boolean>;

    /**
     * 取消订单并恢复库存
     *
     * @description
     * 1. 找到订单，找不到返回 false
     * 2. 检查 status 为 PENDING 或 CONFIRMED，否则返回 false
     * 3. 若 status === CONFIRMED，恢复库存：对每个 item 调用 productService!.updateStock
     *    （先 findProductById 取当前库存，再 updateStock(id, currentStock + item.quantity)）
     * 4. 更新 order.status = CANCELLED
     * 5. 保存订单
     * 6. 查找客户，若找到则调用 notificationService!.sendOrderCancellation(customer, order)
     * 7. 返回 true
     *
     * @param orderId - 订单 ID
     * @returns 成功返回 true，订单不存在或无法取消返回 false
     *
     * @edge-cases
     * - PENDING 订单取消 → 不需要恢复库存
     * - CONFIRMED 订单取消 → 必须恢复库存
     * - PAID/SHIPPED/DELIVERED/CANCELLED 状态 → 返回 false，不能取消
     */
    public abstract cancelOrder(orderId: string): Promise<boolean>;

    /**
     * 按 ID 查找订单
     *
     * @description
     * 1. 调用 db!.findObject('order:' + orderId)
     * 2. 返回 Order 或 undefined
     *
     * @param orderId - 订单 ID
     * @returns Order 对象或 undefined
     */
    public abstract findOrderById(orderId: string): Order | undefined;

    /**
     * 按客户 ID 查找订单
     *
     * @description
     * 1. 获取所有订单（getAllOrders）
     * 2. 过滤 customerId 匹配的订单
     *
     * @param customerId - 客户 ID
     * @returns 该客户的所有订单数组
     */
    public abstract findOrdersByCustomer(customerId: string): Order[];

    /**
     * 按状态获取订单
     *
     * @description
     * 1. 获取所有订单（getAllOrders）
     * 2. 过滤 status 匹配的订单
     *
     * @param status - 订单状态
     * @returns 对应状态的订单数组
     */
    public abstract getOrdersByStatus(status: OrderStatus): Order[];

    /**
     * 获取所有订单
     *
     * @description
     * 1. 调用 db!.getAllKeys()
     * 2. 过滤以 'order:' 开头的 key
     * 3. 对每个 key 调用 db!.findObject(key) 获取订单
     * 4. 返回 Order 数组
     *
     * @returns 所有订单数组，无数据时返回空数组
     */
    public abstract getAllOrders(): Order[];
}
