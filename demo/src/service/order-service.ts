import { AutoGen } from "aesc";
import { Order, OrderStatus, type OrderItem } from "../entity/order";
import { DB } from "./db-service";
import { ProductService } from "./product-service";
import { NotificationService } from "./notification-service";
import { uuid } from "uuidv4";

export abstract class OrderService {
    @AutoGen
    public db?: DB;
    
    @AutoGen
    public productService?: ProductService;
    
    @AutoGen
    public notificationService?: NotificationService;

    // Create a new order with validation and stock checking
    // 1. Generate unique order ID using uuid()
    // 2. Validate each item: check if product exists and has enough stock
    // 3. Calculate total amount
    // 4. Create order with PENDING status
    // 5. Save order to database
    // 6. Send order confirmation notification
    public abstract createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order;

    // Confirm order and reduce stock
    // 1. Find order by ID
    // 2. Check if order is in PENDING status
    // 3. Reduce stock for each item using productService
    // 4. Update order status to CONFIRMED
    // 5. Save updated order
    // 6. Send order confirmed notification
    public abstract confirmOrder(orderId: string): boolean;

    // Process payment for order
    // 1. Find order by ID
    // 2. Check if order is CONFIRMED
    // 3. Update status to PAID
    // 4. Save updated order
    // 5. Send payment confirmation notification
    public abstract processPayment(orderId: string): boolean;

    // Cancel order and restore stock
    // 1. Find order by ID
    // 2. Check if order can be cancelled (PENDING or CONFIRMED status)
    // 3. If order was CONFIRMED, restore stock for each item
    // 4. Update status to CANCELLED
    // 5. Save updated order
    // 6. Send cancellation notification
    public abstract cancelOrder(orderId: string): boolean;

    // Find order by ID
    public abstract findOrderById(orderId: string): Order | undefined;

    // Find orders by customer ID
    public abstract findOrdersByCustomer(customerId: string): Order[];

    // Get orders by status
    public abstract getOrdersByStatus(status: OrderStatus): Order[];

    // Get all orders
    public abstract getAllOrders(): Order[];
}
