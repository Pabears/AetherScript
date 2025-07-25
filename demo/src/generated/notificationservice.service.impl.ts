import { NotificationService } from "../service/notification-service";
import { CacheService } from "../service/cache-service";
import { Customer } from "../entity/customer";
import { Order } from "../entity/order";
import { AutoGen } from "aesc";

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const emailTemplate = `Hello ${customer.getDisplayName()}, your order with ID ${order.id} has been confirmed. Total amount: $${order.calculateTotal().toFixed(2)}.`;
        console.log(`Sending email to ${customer.email}: ${emailTemplate}`);
        await this.cacheService?.cacheData(`notification_${order.id}`, emailTemplate);
        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const items = order.items.map(item => `${item.productId} x ${item.quantity}`).join(', ');
        const confirmationTemplate = `Hello ${customer.getDisplayName()}, your order ${order.id} is confirmed. Items: ${items}. Estimated delivery: 3-5 business days.`;
        console.log(`Sending confirmation to ${customer.email}: ${confirmationTemplate}`);
        await this.cacheService?.cacheData(`notification_${order.id}`, confirmationTemplate);
        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const paymentTemplate = `Hello ${customer.getDisplayName()}, your payment of $${order.calculateTotal().toFixed(2)} for order ${order.id} has been confirmed.`;
        console.log(`Sending payment confirmation to ${customer.email}: ${paymentTemplate}`);
        await this.cacheService?.cacheData(`notification_${order.id}`, paymentTemplate);
        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const cancellationTemplate = `Hello ${customer.getDisplayName()}, your order ${order.id} has been cancelled. Refund will be processed shortly.`;
        console.log(`Sending cancellation notification to ${customer.email}: ${cancellationTemplate}`);
        await this.cacheService?.cacheData(`notification_${order.id}`, cancellationTemplate);
        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        const notifications = await this.cacheService?.getCachedData(`notifications_${customerId}`);
        return notifications ? Array.isArray(notifications) ? notifications : [notifications] : [];
    }
}