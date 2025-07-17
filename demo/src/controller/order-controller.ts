import { AutoGen } from "aesc";
import { Order, OrderStatus, type OrderItem } from "../entity/order";
import { OrderService } from "../service/order-service";

export class OrderController {
    @AutoGen
    public orderService?: OrderService;

    createOrder(customerId: string, items: Omit<OrderItem, 'unitPrice'>[]): Order {
        return this.orderService!.createOrder(customerId, items);
    }

    confirmOrder(orderId: string): boolean {
        return this.orderService!.confirmOrder(orderId);
    }

    processPayment(orderId: string): boolean {
        return this.orderService!.processPayment(orderId);
    }

    cancelOrder(orderId: string): boolean {
        return this.orderService!.cancelOrder(orderId);
    }

    getOrder(orderId: string): Order | undefined {
        return this.orderService!.findOrderById(orderId);
    }

    getCustomerOrders(customerId: string): Order[] {
        return this.orderService!.findOrdersByCustomer(customerId);
    }

    getOrdersByStatus(status: OrderStatus): Order[] {
        return this.orderService!.getOrdersByStatus(status);
    }

    getAllOrders(): Order[] {
        return this.orderService!.getAllOrders();
    }
}
