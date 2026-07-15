import { NotificationService } from '../service/notification-service';
import { Customer } from '../entity/customer';
import { Order } from '../entity/order';

export class NotificationServiceImpl extends NotificationService {
    private pendingPromises = new Map<string, Promise<any>>();

    private async queueAction<T>(customerId: string, action: () => Promise<T>): Promise<T> {
        const key = 'notification:' + customerId;
        const current = this.pendingPromises.get(key) || Promise.resolve();
        const next = current.then(action).catch(() => action());
        this.pendingPromises.set(key, next);
        return next;
    }

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
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单确认 #${order.id}: 共 ${order.items.length} 件商品`;
        console.log(`[Notification] sendOrderConfirmation → ${customer.name}: ${message}`);
        return this.queueAction(customer.id, async () => {
            const history = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
            history.push(message);
            await this.cacheService!.cacheData('notification:' + customer.id, history);
            return true;
        });
    }

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
    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单已确认 #${order.id}: 总金额 ${order.totalAmount}`;
        console.log(`[Notification] sendOrderConfirmed → ${customer.name}: ${message}`);
        return this.queueAction(customer.id, async () => {
            const history = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
            history.push(message);
            await this.cacheService!.cacheData('notification:' + customer.id, history);
            return true;
        });
    }

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
    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const message = `支付成功 #${order.id}: 金额 ${order.totalAmount}`;
        console.log(`[Notification] sendPaymentConfirmation → ${customer.name}: ${message}`);
        return this.queueAction(customer.id, async () => {
            const history = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
            history.push(message);
            await this.cacheService!.cacheData('notification:' + customer.id, history);
            return true;
        });
    }

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
    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单已取消 #${order.id}`;
        console.log(`[Notification] sendOrderCancellation → ${customer.name}: ${message}`);
        return this.queueAction(customer.id, async () => {
            const history = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
            history.push(message);
            await this.cacheService!.cacheData('notification:' + customer.id, history);
            return true;
        });
    }

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
    public async getNotificationHistory(customerId: string): Promise<string[]> {
        return this.queueAction(customerId, async () => {
            const history = await this.cacheService!.getCachedData('notification:' + customerId);
            return Array.isArray(history) ? history : [];
        });
    }
}
