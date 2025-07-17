import { NotificationService } from "../service/notification-service";
import { CacheService } from "../service/cache-service";
import { Customer } from "../entity/customer";
import { Order } from "../entity/order";
import { AutoGen } from "aesc";

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const emailTemplate = `
            Dear ${customer.getDisplayName()},
            
            Thank you for your order! Here are the details:
            Order ID: ${order.id}
            Total Amount: $${order.calculateTotal().toFixed(2)}
            
            We will send a confirmation once the order is processed.
            
            Best regards,
            Your Company
        `;

        console.log(`Sending email to ${customer.email}:\n${emailTemplate}`);

        await this.cacheService?.cacheData(`notification_${order.id}`, {
            type: 'OrderConfirmation',
            message: emailTemplate,
            sentAt: new Date().toLocaleString()
        });

        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const confirmationTemplate = `
            Dear ${customer.getDisplayName()},
            
            Your order (${order.id}) has been confirmed!
            
            Items:
            ${order.items.map(item => `- ${item.quantity} x ${item.productId}`).join('\n')}
            
            Estimated Delivery: 3-5 business days
            
            Best regards,
            Your Company
        `;

        console.log(`Sending confirmation to ${customer.email}:\n${confirmationTemplate}`);

        await this.cacheService?.cacheData(`notification_${order.id}`, {
            type: 'OrderConfirmed',
            message: confirmationTemplate,
            sentAt: new Date().toLocaleString()
        });

        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const paymentTemplate = `
            Dear ${customer.getDisplayName()},
            
            Payment for your order (${order.id}) has been confirmed!
            
            Amount: $${order.calculateTotal().toFixed(2)}
            
            Best regards,
            Your Company
        `;

        console.log(`Sending payment confirmation to ${customer.email}:\n${paymentTemplate}`);

        await this.cacheService?.cacheData(`notification_${order.id}`, {
            type: 'PaymentConfirmation',
            message: paymentTemplate,
            sentAt: new Date().toLocaleString()
        });

        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const cancellationTemplate = `
            Dear ${customer.getDisplayName()},
            
            Your order (${order.id}) has been cancelled.
            
            Reason: [Insert reason here]
            Refund will be processed within 5 business days.
            
            Best regards,
            Your Company
        `;

        console.log(`Sending cancellation notification to ${customer.email}:\n${cancellationTemplate}`);

        await this.cacheService?.cacheData(`notification_${order.id}`, {
            type: 'OrderCancellation',
            message: cancellationTemplate,
            sentAt: new Date().toLocaleString()
        });

        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        const notifications = await this.cacheService?.getCachedData(`notifications_${customerId}`);
        if (Array.isArray(notifications)) {
            return notifications.map((notification: any) => notification.message);
        }
        return [];
    }
}