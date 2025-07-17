export interface OrderItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

export enum OrderStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    PAID = 'PAID',
    SHIPPED = 'SHIPPED',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED'
}

export class Order {
    constructor(
        public id: string,
        public customerId: string,
        public items: OrderItem[],
        public status: OrderStatus = OrderStatus.PENDING,
        public createdAt: Date = new Date(),
        public totalAmount?: number
    ) {}

    public calculateTotal(): number {
        return this.items.reduce((total, item) => {
            return total + (item.quantity * item.unitPrice);
        }, 0);
    }

    public getItemCount(): number {
        return this.items.reduce((count, item) => count + item.quantity, 0);
    }
}
