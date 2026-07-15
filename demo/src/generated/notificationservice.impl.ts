import { Customer } from '../entity/customer';
import { Order } from '../entity/order';
import { NotificationService } from '../service/notification-service';

export class NotificationServiceImpl extends NotificationService {
    private async saveToHistory(customerId: string, message: string): Promise<void> {
        const cacheKey = 'notification:' + customerId;
        const history = await this.cacheService!.getCachedData(cacheKey);
        const updatedHistory = Array.isArray(history) ? [...history] : [];
        updatedHistory.push(message);
        await this.cacheService!.cacheData(cacheKey, updatedHistory);
    }

    /**
     * 发送订单确认通知
     */
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单确认 #${order.id}: 共 ${order.items.length} 件商品`;
        console.log(`[Notification] sendOrderConfirmation → ${customer.name}: ${message}`);
        await this.saveToHistory(customer.id, message);
        return true;
    }

    /**
     * 发送订单确认通知（订单已确认状态）
     */
    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单已确认 #${order.id}: 总金额 ${order.totalAmount}`;
        console.log(`[Notification] sendOrderConfirmed → ${customer.name}: ${message}`);
        await this.saveToHistory(customer.id, message);
        return true;
    }

    /**
     * 发送支付确认通知
     */
    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const message = `支付成功 #${order.id}: 金额 ${order.totalAmount}`;
        console.log(`[Notification] sendPaymentConfirmation → ${customer.name}: ${message}`);
        await this.saveToHistory(customer.id, message);
        return true;
    }

    /**
     * 发送订单取消通知
     */
    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单已取消 #${order.id}`;
        console.log(`[Notification] sendOrderCancellation → ${customer.name}: ${message}`);
        await this.saveToHistory(customer.id, message);
        return true;
    }

    /**
     * 获取客户的通知历史
     */
    public async getNotificationHistory(customerId: string): Promise<string[]> {
        const history = await this.cacheService!.getCachedData('notification:' + customerId);
        if (Array.isArray(history)) {
            return history;
        }
        return [];
    }
}
