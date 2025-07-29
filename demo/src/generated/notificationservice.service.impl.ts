import { NotificationService } from "../service/notification-service";
import { CacheService } from "../service/cache-service";
import { Customer } from "../entity/customer";
import { Order } from "../entity/order";
import { AutoGen } from "aesc";

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer.email)) {
            console.error('Invalid customer email');
            return false;
        }

        const emailTemplate = `
            Dear ${customer.getDisplayName()},
            Thank you for your order! Your order #${order.id} has been confirmed.
            Total amount: $${order.calculateTotal().toFixed(2)}
        `;
        console.log(`Sending order confirmation email to ${customer.email}:`, emailTemplate);

        await this.cacheService?.cacheData(`notification_${order.id}`, emailTemplate);
        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const confirmationTemplate = `
            Dear ${customer.getDisplayName()},
            Your order #${order.id} has been confirmed and will be shipped soon.
            Items: ${order.items.map(item => `${item.productId} x ${item.quantity}`).join(', ')}
            Estimated delivery: 3-5 business days
        `;
        console.log(`Sending order confirmation notification to ${customer.getDisplayName()}:`, confirmationTemplate);

        await this.cacheService?.cacheData(`notification_${order.id}`, confirmationTemplate);
        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const paymentTemplate = `
            Dear ${customer.getDisplayName()},
            Your payment for order #${order.id} has been successfully processed.
            Amount: $${order.calculateTotal().toFixed(2)}
            Order details: ${order.items.map(item => `${item.productId} x ${item.quantity}`).join(', ')}
        `;
        console.log(`Sending payment confirmation notification to ${customer.getDisplayName()}:`, paymentTemplate);

        await this.cacheService?.cacheData(`notification_${order.id}`, paymentTemplate);
        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const cancellationTemplate = `
            Dear ${customer.getDisplayName()},
            Your order #${order.id} has been cancelled.
            Reason: Not specified
            Refund will be processed shortly.
        `;
        console.log(`Sending order cancellation notification to ${customer.getDisplayName()}:`, cancellationTemplate);

        await this.cacheService?.cacheData(`notification_${order.id}`, cancellationTemplate);
        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        const notifications = await this.cacheService?.getCachedData(`notifications_${customerId}`);
        return notifications ? Array.isArray(notifications) ? notifications : [notifications] : [];
    }
}