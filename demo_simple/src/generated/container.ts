// Generated by AutoGen at 2025-07-25T11:54:54.742Z
import { UserServiceImpl } from './userservice.service.impl';
import { DBImpl } from './db.service.impl';
import { UserServiceImpl } from './userservice.service.impl';
import { DBImpl } from './db.service.impl';

interface ServiceMap {
    'UserService': UserServiceImpl;
    'DB': DBImpl;
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
        'Userservice': () => {
            const instance = new UserServiceImpl();
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
