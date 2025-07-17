import { AutoGen } from "aesc";
import { Order } from "../entity/order";
import { Customer } from "../entity/customer";
import { CacheService } from "./cache-service";

export interface NotificationTemplate {
    subject: string;
    body: string;
}

export abstract class NotificationService {
    @AutoGen
    public cacheService?: CacheService;

    // Send order confirmation email
    // 1. Create email template with order details
    // 2. Format message with customer name, order ID, total amount
    // 3. Log email sending (simulate email service)
    // 4. Cache notification for tracking
    public abstract sendOrderConfirmation(customer: Customer, order: Order): Promise<boolean>;

    // Send order confirmed notification
    // 1. Create confirmation template
    // 2. Include order items and estimated delivery
    // 3. Log notification sending
    // 4. Cache notification
    /**
     * Send order status update notification
     * @param customer Customer information
     * @param order Order information
     * @returns Returns true if sent successfully
     * 
     * Implementation hint: Use this.cacheService?.cacheData() to cache customer data
     */
    public abstract sendOrderConfirmed(customer: Customer, order: Order): Promise<boolean>;

    // Send payment confirmation
    // 1. Create payment success template
    // 2. Include payment amount and order details
    // 3. Log notification sending
    // 4. Cache notification
    /**
     * Send payment confirmation notification
     * @param customer Customer information
     * @param order Order information
     * @returns Returns true if sent successfully
     * 
     * Implementation hint: Use this.cacheService?.cacheData() to cache customer data
     */
    public abstract sendPaymentConfirmation(customer: Customer, order: Order): Promise<boolean>;

    // Send order cancellation notification
    // 1. Create cancellation template
    // 2. Include cancellation reason and refund info
    // 3. Log notification sending
    // 4. Cache notification
    /**
     * Send order cancellation notification
     * @param customer Customer information
     * @param order Order information
     * @returns Returns true if sent successfully
     * 
     * Implementation hint: Use this.cacheService?.cacheData() to cache customer data
     */
    public abstract sendOrderCancellation(customer: Customer, order: Order): Promise<boolean>;

    // Get notification history for customer
    // 1. Retrieve cached notifications by customer ID
    // 2. Return list of sent notifications
    /**
     * Get customer's notification history
     * @param customerId Customer ID
     * @returns Notification history list
     * 
     * Implementation hint: Use this.cacheService?.getCachedData() to get cached data
     */
    public abstract getNotificationHistory(customerId: string): Promise<string[]>;
}
