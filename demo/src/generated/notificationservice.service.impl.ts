import { NotificationService } from "../service/notification-service";
import { CacheService } from "../service/cache-service";
import { Customer } from "../entity/customer";
import { Order } from "../entity/order";
import { AutoGen } from "aesc";

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const emailTemplate = `
            Hello ${customer.getDisplayName()},
            Thank you for your order! Your order ID is ${order.id} and the total amount is $${order.calculateTotal().toFixed(2)}.
            We will notify you once your order is confirmed.
        `;
        console.log(`Sending order confirmation email to ${customer.email}:`, emailTemplate);

        await this.cacheService?.cacheData(`notification:${order.id}`, emailTemplate);
        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const confirmationTemplate = `
            Hello ${customer.getDisplayName()},
            Your order ${order.id} has been confirmed. It includes ${order.getItemCount()} items and is estimated to be delivered soon.
        `;
        console.log(`Sending order confirmed notification to ${customer.email}:`, confirmationTemplate);

        await this.cacheService?.cacheData(`notification:${order.id}`, confirmationTemplate);
        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const paymentTemplate = `
            Hello ${customer.getDisplayName()},
            Your payment of $${order.calculateTotal().toFixed(2)} for order ${order.id} has been successfully confirmed.
        `;
        console.log(`Sending payment confirmation notification to ${customer.email}:`, paymentTemplate);

        await this.cacheService?.cacheData(`notification:${order.id}`, paymentTemplate);
        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        if (!customer.isValidEmail()) return false;

        const cancellationTemplate = `
            Hello ${customer.getDisplayName()},
            Your order ${order.id} has been cancelled. A refund will be processed shortly.
        `;
        console.log(`Sending order cancellation notification to ${customer.email}:`, cancellationTemplate);

        await this.cacheService?.cacheData(`notification:${order.id}`, cancellationTemplate);
        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        const notifications = await this.cacheService?.getCachedData(`notifications:${customerId}`);
        return Array.isArray(notifications) ? notifications : [];
    }
}