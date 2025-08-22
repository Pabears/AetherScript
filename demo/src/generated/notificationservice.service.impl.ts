import { NotificationService } from "../service/notification-service";
import { CacheService } from "../service/cache-service";
import { Customer } from "../entity/customer";
import { Order } from "../entity/order";
import { AutoGen } from "aesc";

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Order Confirmation - ${order.id}`;
        const body = `Dear ${customer.getDisplayName()}, your order ${order.id} has been confirmed. Total amount: $${order.calculateTotal().toFixed(2)}.`;
        
        console.log(`Sending email to ${customer.email}: ${subject}`);
        
        const cacheKey = `notification:${customer.id}:confirmation:${order.id}`;
        await this.cacheService?.cacheData(cacheKey, {
            subject,
            body,
            timestamp: new Date(),
            orderId: order.id
        });
        
        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Order Confirmed - ${order.id}`;
        const body = `Dear ${customer.getDisplayName()}, your order ${order.id} has been confirmed. Items: ${order.getItemCount()}. Estimated delivery: 3-5 business days.`;
        
        console.log(`Sending notification to ${customer.email}: ${subject}`);
        
        const cacheKey = `notification:${customer.id}:confirmed:${order.id}`;
        await this.cacheService?.cacheData(cacheKey, {
            subject,
            body,
            timestamp: new Date(),
            orderId: order.id
        });
        
        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Payment Confirmation - ${order.id}`;
        const body = `Dear ${customer.getDisplayName()}, your payment of $${order.calculateTotal().toFixed(2)} for order ${order.id} has been processed successfully.`;
        
        console.log(`Sending payment confirmation to ${customer.email}: ${subject}`);
        
        const cacheKey = `notification:${customer.id}:payment:${order.id}`;
        await this.cacheService?.cacheData(cacheKey, {
            subject,
            body,
            timestamp: new Date(),
            orderId: order.id
        });
        
        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Order Cancelled - ${order.id}`;
        const body = `Dear ${customer.getDisplayName()}, your order ${order.id} has been cancelled. A refund of $${order.calculateTotal().toFixed(2)} will be processed to your account.`;
        
        console.log(`Sending cancellation notification to ${customer.email}: ${subject}`);
        
        const cacheKey = `notification:${customer.id}:cancelled:${order.id}`;
        await this.cacheService?.cacheData(cacheKey, {
            subject,
            body,
            timestamp: new Date(),
            orderId: order.id
        });
        
        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        const cacheKey = `notification:${customerId}:history`;
        const cachedData = await this.cacheService?.getCachedData(cacheKey);
        return cachedData || [];
    }
}