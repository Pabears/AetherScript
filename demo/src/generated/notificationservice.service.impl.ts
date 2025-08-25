import { NotificationService } from "../service/notification-service";
import { CacheService } from "../service/cache-service";
import { Customer } from "../entity/customer";
import { Order } from "../entity/order";
import { AutoGen } from "aesc";

export class NotificationServiceImpl extends NotificationService {
    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Order Confirmation for ${customer.getDisplayName()}`;
        const body = `Dear ${customer.getDisplayName()},
    
Thank you for your order #${order.id}. 
Your order total is $${order.calculateTotal().toFixed(2)}.
    
Estimated delivery date: TBD
    
Best regards,
The Store Team`;

        console.log(`Sending email to ${customer.email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:order_confirmation`, {
                orderId: order.id,
                timestamp: new Date(),
                status: 'sent'
            });
        }
        
        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Order #${order.id} Confirmed`;
        const body = `Dear ${customer.getDisplayName()},
    
Your order #${order.id} has been confirmed.
    
Order details:
- Items: ${order.getItemCount()}
- Total: $${order.calculateTotal().toFixed(2)}
- Estimated delivery: TBD
    
Best regards,
The Store Team`;

        console.log(`Sending email to ${customer.email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:order_confirmed`, {
                orderId: order.id,
                timestamp: new Date(),
                status: 'sent'
            });
        }
        
        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Payment Confirmation for Order #${order.id}`;
        const body = `Dear ${customer.getDisplayName()},
    
Your payment of $${order.calculateTotal().toFixed(2)} for order #${order.id} has been processed successfully.
    
Order details:
- Items: ${order.getItemCount()}
- Total: $${order.calculateTotal().toFixed(2)}
    
Best regards,
The Store Team`;

        console.log(`Sending email to ${customer.email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:payment_confirmation`, {
                orderId: order.id,
                timestamp: new Date(),
                status: 'sent'
            });
        }
        
        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const subject = `Order #${order.id} Has Been Cancelled`;
        const body = `Dear ${customer.getDisplayName()},
    
We regret to inform you that your order #${order.id} has been cancelled.
    
Refund amount: $${order.calculateTotal().toFixed(2)}
Refund will be processed within 5-7 business days.
    
Best regards,
The Store Team`;

        console.log(`Sending email to ${customer.email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        
        if (this.cacheService) {
            await this.cacheService.cacheData(`notification:${customer.id}:order_cancellation`, {
                orderId: order.id,
                timestamp: new Date(),
                status: 'sent'
            });
        }
        
        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        if (!this.cacheService) {
            return [];
        }
        
        const cachedData = await this.cacheService.getCachedData(`notifications:${customerId}`);
        return cachedData || [];
    }
}