import { NotificationService } from '../service/notification-service';
import { Order } from '../entity/order';
import { Customer } from '../entity/customer';

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单确认 #${order.id}: 共 ${order.items.length} 件商品`;
        console.log(`[Notification] sendOrderConfirmation → ${customer.name}: ${message}`);
        const history: string[] = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
        history.push(message);
        await this.cacheService!.cacheData('notification:' + customer.id, history);
        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单已确认 #${order.id}: 总金额 ${order.totalAmount}`;
        console.log(`[Notification] sendOrderConfirmed → ${customer.name}: ${message}`);
        const history: string[] = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
        history.push(message);
        await this.cacheService!.cacheData('notification:' + customer.id, history);
        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const message = `支付成功 #${order.id}: 金额 ${order.totalAmount}`;
        console.log(`[Notification] sendPaymentConfirmation → ${customer.name}: ${message}`);
        const history: string[] = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
        history.push(message);
        await this.cacheService!.cacheData('notification:' + customer.id, history);
        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const message = `订单已取消 #${order.id}`;
        console.log(`[Notification] sendOrderCancellation → ${customer.name}: ${message}`);
        const history: string[] = (await this.cacheService!.getCachedData('notification:' + customer.id)) ?? [];
        history.push(message);
        await this.cacheService!.cacheData('notification:' + customer.id, history);
        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        const data = await this.cacheService!.getCachedData('notification:' + customerId);
        return Array.isArray(data) ? data : [];
    }
}
