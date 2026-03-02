
import { CacheServiceImpl } from './cacheservice.impl';
import { CustomerServiceImpl } from './customerservice.impl';
import { DBImpl } from './db.impl';
import { NotificationServiceImpl } from './notificationservice.impl';
import { OrderServiceImpl } from './orderservice.impl';
import { ProductServiceImpl } from './productservice.impl';
import { UserServiceImpl } from './userservice.impl';

class Container {
    private services = new Map<string, any>();

    constructor() {
        this.registerServices();
    }

    private registerServices() {
        // 1. Instantiate
        const cacheService = new CacheServiceImpl();
        const customerService = new CustomerServiceImpl();
        const dB = new DBImpl();
        const notificationService = new NotificationServiceImpl();
        const orderService = new OrderServiceImpl();
        const productService = new ProductServiceImpl();
        const userService = new UserServiceImpl();

        // 2. Inject
        customerService.db = dB; // Injected DB
        customerService.notificationService = notificationService; // Injected NotificationService
        notificationService.cacheService = cacheService; // Injected CacheService
        orderService.db = dB; // Injected DB
        orderService.productService = productService; // Injected ProductService
        orderService.notificationService = notificationService; // Injected NotificationService
        productService.db = dB; // Injected DB
        userService.db = dB; // Injected DB

        // 3. Register
        this.services.set('CacheService', cacheService);
        this.services.set('CustomerService', customerService);
        this.services.set('DB', dB);
        this.services.set('NotificationService', notificationService);
        this.services.set('OrderService', orderService);
        this.services.set('ProductService', productService);
        this.services.set('UserService', userService);
    }

    public get(name: string): any {
        return this.services.get(name);
    }
}

export const container = new Container();
