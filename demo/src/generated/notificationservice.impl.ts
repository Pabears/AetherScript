// Generated from /Users/shiheng/myproject/AetherScript/demo/src/service/notification-service.ts
import { NotificationService } from '../service/notification-service';
import { Order } from "../entity/order";
import { Customer } from "../entity/customer";
import { CacheService } from "../service/cache-service";

export class NotificationServiceImpl extends NotificationService {

    public async sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const subject = "Order Confirmation";
        const body = `Hello ${customer.name}, your order ${order.id} for ${order.totalAmount ?? order.calculateTotal()} has been confirmed.`;
        console.log(`Sending email to ${customer.email}: [${subject}] - ${body}`);

        const history = await this.getNotificationHistory(customer.id);
        history.push(`Sent Order Confirmation: ${order.id}`);

        if (this.cacheService) {
            await this.cacheService.cacheData(`notifications_${customer.id}`, history);
        }

        return true;
    }

    public async sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean> {
        const subject = "Order Confirmed Update";
        const body = `Your order ${order.id} with ${order.getItemCount()} items is confirmed and preparing for delivery.`;
        console.log(`Sending notification to ${customer.email}: [${subject}] - ${body}`);

        const history = await this.getNotificationHistory(customer.id);
        history.push(`Sent Order Confirmed Update: ${order.id}`);

        if (this.cacheService) {
            await this.cacheService.cacheData(`notifications_${customer.id}`, history);
            await this.cacheService.cacheData(`customer_${customer.id}`, customer);
        }

        return true;
    }

    public async sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean> {
        const subject = "Payment Confirmation";
        const body = `Payment of ${order.totalAmount ?? order.calculateTotal()} for order ${order.id} received successfully.`;
        console.log(`Sending notification to ${customer.email}: [${subject}] - ${body}`);

        const history = await this.getNotificationHistory(customer.id);
        history.push(`Sent Payment Confirmation: ${order.id}`);

        if (this.cacheService) {
            await this.cacheService.cacheData(`notifications_${customer.id}`, history);
            await this.cacheService.cacheData(`customer_${customer.id}`, customer);
        }

        return true;
    }

    public async sendOrderCancellation(customer: Customer, order: Order): Promise<boolean> {
        const subject = "Order Cancelled";
        const body = `Your order ${order.id} has been cancelled. If you have paid, a refund will be issued.`;
        console.log(`Sending notification to ${customer.email}: [${subject}] - ${body}`);

        const history = await this.getNotificationHistory(customer.id);
        history.push(`Sent Order Cancellation: ${order.id}`);

        if (this.cacheService) {
            await this.cacheService.cacheData(`notifications_${customer.id}`, history);
            await this.cacheService.cacheData(`customer_${customer.id}`, customer);
        }

        return true;
    }

    public async getNotificationHistory(customerId: string): Promise<string[]> {
        if (this.cacheService) {
            const data = await this.cacheService.getCachedData(`notifications_${customerId}`);
            if (data && Array.isArray(data)) {
                return data as string[];
            }
        }
        return [];
    }

    public sendNotification(customerId: string, message: string): void {
        console.log(`Sending generic notification to ${customerId}: ${message}`);

        this.getNotificationHistory(customerId).then(history => {
            history.push(`Sent Notification: ${message}`);
            if (this.cacheService) {
                this.cacheService.cacheData(`notifications_${customerId}`, history).catch(err => {
                    console.error('Failed to cache notification history', err);
                });
            }
        }).catch(err => {
            console.error('Failed to retrieve notification history', err);
        });
    }

    public isValidEmail(email: string): boolean {
        return email.includes('@') && email.includes('.');
    }
}