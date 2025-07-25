// Generated by AutoGen at 2025-07-25T13:24:16.274Z
import { UserServiceImpl } from './userservice.service.impl';
import { DBImpl } from './db.service.impl';
import { CacheServiceImpl } from './cacheservice.service.impl';
import { ProductServiceImpl } from './productservice.service.impl';
import { CustomerServiceImpl } from './customerservice.service.impl';
import { NotificationServiceImpl } from './notificationservice.service.impl';
import { OrderServiceImpl } from './orderservice.service.impl';
import { OrderServiceImpl } from './orderservice.service.impl';
import { ProductServiceImpl } from './productservice.service.impl';
import { CustomerServiceImpl } from './customerservice.service.impl';
import { NotificationServiceImpl } from './notificationservice.service.impl';
import { CacheServiceImpl } from './cacheservice.service.impl';
import { UserServiceImpl } from './userservice.service.impl';
import { DBImpl } from './db.service.impl';

interface ServiceMap {
    'UserService': UserServiceImpl;
    'DB': DBImpl;
    'CacheService': CacheServiceImpl;
    'ProductService': ProductServiceImpl;
    'CustomerService': CustomerServiceImpl;
    'NotificationService': NotificationServiceImpl;
    'OrderService': OrderServiceImpl;
    'Orderservice': OrderServiceImpl;
    'Productservice': ProductServiceImpl;
    'Customerservice': CustomerServiceImpl;
    'Notificationservice': NotificationServiceImpl;
    'Cacheservice': CacheServiceImpl;
    'Userservice': UserServiceImpl;
    'Db': DBImpl;
}

class Container {
    private instances: Map<keyof ServiceMap, any> = new Map();

    private factories: { [K in keyof ServiceMap]: () => ServiceMap[K] };

    constructor() {
        this.factories = {
        'UserService': () => {
            const instance = new UserServiceImpl();
            instance.db = this.get('DB');
            return instance;
        },
        'DB': () => {
            const instance = new DBImpl();
            return instance;
        },
        'CacheService': () => {
            const instance = new CacheServiceImpl();
            return instance;
        },
        'ProductService': () => {
            const instance = new ProductServiceImpl();
            instance.db = this.get('DB');
            return instance;
        },
        'CustomerService': () => {
            const instance = new CustomerServiceImpl();
            instance.db = this.get('DB');
            return instance;
        },
        'NotificationService': () => {
            const instance = new NotificationServiceImpl();
            instance.cacheService = this.get('CacheService');
            return instance;
        },
        'OrderService': () => {
            const instance = new OrderServiceImpl();
            instance.db = this.get('DB');
            instance.productService = this.get('ProductService');
            instance.notificationService = this.get('NotificationService');
            return instance;
        },
        'Orderservice': () => {
            const instance = new OrderServiceImpl();
            instance.db = this.get('DB');
            instance.productService = this.get('ProductService');
            instance.notificationService = this.get('NotificationService');
            return instance;
        },
        'Productservice': () => {
            const instance = new ProductServiceImpl();
            instance.db = this.get('DB');
            return instance;
        },
        'Customerservice': () => {
            const instance = new CustomerServiceImpl();
            instance.db = this.get('DB');
            return instance;
        },
        'Notificationservice': () => {
            const instance = new NotificationServiceImpl();
            instance.cacheService = this.get('CacheService');
            return instance;
        },
        'Cacheservice': () => {
            const instance = new CacheServiceImpl();
            return instance;
        },
        'Userservice': () => {
            const instance = new UserServiceImpl();
            instance.db = this.get('DB');
            return instance;
        },
        'Db': () => {
            const instance = new DBImpl();
            return instance;
        }
        };
    }

    public get<K extends keyof ServiceMap>(identifier: K): ServiceMap[K] {
        if (!this.instances.has(identifier)) {
            const factory = this.factories[identifier];
            if (!factory) {
                throw new Error('Service not found for identifier: ' + identifier);
            }
            const instance = factory();
            this.instances.set(identifier, instance);
        }
        return this.instances.get(identifier) as ServiceMap[K];
    }
}

export const container = new Container();
