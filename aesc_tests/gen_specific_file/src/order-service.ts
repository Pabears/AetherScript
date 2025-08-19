import { AutoGen } from 'aesc';
import { DB } from './db-service';

export abstract class OrderService {
    @AutoGen
    public db?: DB;

    // create a new order
    abstract createOrder(orderId: string): void;
}
