import { NotificationService } from "../service/notification-service";
import { CacheService } from "../service/cache-service";
import { Customer } from "../entity/customer";
import { Order } from "../entity/order";
import { AutoGen } from "aesc";

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        // Create email template with order details
        const template = `Dear ${customer.getDisplayName()}, 
        Thank you for your order #${order.id}. 
        Total amount: $${order.calculateTotal()}. 
        Order status: ${order.status}`;
        
        // Log email sending (simulate email service)
        console.log(`Sending confirmation email to ${customer.email}: ${template}`);
        
        // Cache notification for tracking
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:${order.id}`, {
                type: 'confirmation',
                orderId: order.id,
                timestamp: new Date()
            });
        }
        
        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        // Create confirmation template
        const template = `Dear ${customer.getDisplayName()}, 
        Your order #${order.id} has been confirmed. 
        Items: ${order.getItemCount()}. 
        Estimated delivery: 3-5 business days.`;
        
        // Log notification sending
        console.log(`Sending confirmed notification to ${customer.email}: ${template}`);
        
        // Cache notification
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:${order.id}`, {
                type: 'confirmed',
                orderId: order.id,
                timestamp: new Date()
            });
        }
        
        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        // Create payment success template
        const template = `Dear ${customer.getDisplayName()}, 
        Payment successful for order #${order.id}. 
        Amount paid: $${order.calculateTotal()}. 
        Payment status: completed.`;
        
        // Log notification sending
        console.log(`Sending payment confirmation to ${customer.email}: ${template}`);
        
        // Cache notification
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:${order.id}`, {
                type: 'payment',
                orderId: order.id,
                timestamp: new Date()
            });
        }
        
        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        // Create cancellation template
        const template = `Dear ${customer.getDisplayName()}, 
        Your order #${order.id} has been cancelled. 
        Reason: Order was cancelled by customer. 
        Refund will be processed within 5 business days.`;
        
        // Log notification sending
        console.log(`Sending cancellation notification to ${customer.email}: ${template}`);
        
        // Cache notification
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:${order.id}`, {
                type: 'cancellation',
                orderId: order.id,
                timestamp: new Date()
            });
        }
        
        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        // Retrieve cached notifications by customer ID
        if (this.cacheService) {
            const cachedData = await this.cacheService.getCachedData(`notifications:${customerId}`);
            return cachedData || [];
        }
        
        return [];
    }
}