import { Order } from '../entity/order';
import { Customer } from '../entity/customer';
import { CacheService } from './cache-service';

export interface NotificationTemplate {
    subject: string;
    body: string;
}

// @autogen
/**
 * NotificationService — 通知服务（邮件模拟 + 缓存记录）
 *
 * 架构约束：
 * - 依赖 CacheService 缓存通知记录（@AutoGen 注入）
 * - 所有方法为 async，返回 Promise
 * - 通知不真实发送，只记录日志并缓存到 cacheService
 * - 缓存 key 格式：'notification:' + customerId
 */
export abstract class NotificationService {
    // @AutoGen
    public cacheService?: CacheService;

    /**
     * 发送订单确认通知
     *
     * @description
     * 1. 构建通知消息：`订单确认 #${order.id}: 共 ${order.items.length} 件商品`
     * 2. 打印日志：`[Notification] sendOrderConfirmation → ${customer.name}: ${message}`
     * 3. 获取现有通知历史：await this.cacheService!.getCachedData('notification:' + customer.id) ?? []
     * 4. 追加 message 到历史数组
     * 5. 调用 await this.cacheService!.cacheData('notification:' + customer.id, updatedHistory)
     * 6. 返回 true
     *
     * @param customer - 客户信息
     * @param order - 订单信息
     * @returns 发送成功返回 true
     */
    public abstract sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean>;

    /**
     * 发送订单确认通知（订单已确认状态）
     *
     * @description
     * 1. 构建通知消息：`订单已确认 #${order.id}: 总金额 ${order.totalAmount}`
     * 2. 打印日志：`[Notification] sendOrderConfirmed → ${customer.name}: ${message}`
     * 3. 获取并更新通知历史（与 sendOrderConfirmation 相同的缓存逻辑）
     * 4. 返回 true
     *
     * @param customer - 客户信息
     * @param order - 订单信息
     * @returns 发送成功返回 true
     */
    public abstract sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean>;

    /**
     * 发送支付确认通知
     *
     * @description
     * 1. 构建通知消息：`支付成功 #${order.id}: 金额 ${order.totalAmount}`
     * 2. 打印日志：`[Notification] sendPaymentConfirmation → ${customer.name}: ${message}`
     * 3. 获取并更新通知历史
     * 4. 返回 true
     *
     * @param customer - 客户信息
     * @param order - 订单信息
     * @returns 发送成功返回 true
     */
    public abstract sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean>;

    /**
     * 发送订单取消通知
     *
     * @description
     * 1. 构建通知消息：`订单已取消 #${order.id}`
     * 2. 打印日志：`[Notification] sendOrderCancellation → ${customer.name}: ${message}`
     * 3. 获取并更新通知历史
     * 4. 返回 true
     *
     * @param customer - 客户信息
     * @param order - 订单信息
     * @returns 发送成功返回 true
     */
    public abstract sendOrderCancellation(customer: Customer, order: Order): Promise<boolean>;

    /**
     * 获取客户的通知历史
     *
     * @description
     * 1. 调用 await this.cacheService!.getCachedData('notification:' + customerId)
     * 2. 若返回值为数组则返回，否则返回空数组
     *
     * @param customerId - 客户 ID
     * @returns 通知消息字符串数组
     */
    public abstract getNotificationHistory(customerId: string): Promise<string[]>;
}
