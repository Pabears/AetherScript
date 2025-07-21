import { CustomerService } from "../service/customer-service";
import { DB } from "../service/db-service";
import { Customer } from "../entity/customer";
import { AutoGen } from "aesc";

export class CustomerServiceImpl extends CustomerService {
    public createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        if (name.length === 0) {
            throw new Error('Name must be provided');
        }
        const customer = new Customer('', name, email, phone, address);
        if (!customer.isValidEmail()) {
            throw new Error('Invalid email format');
        }
        const existingCustomer = this.findCustomerByEmail(email);
        if (existingCustomer) {
            throw new Error('Email already exists');
        }
        customer.id = crypto.randomUUID();
        this.db?.saveObject(customer.id, customer);
        return customer;
    }

    public findCustomerById(customerId: string): Customer | undefined {
        return this.db?.findObject(customerId) as Customer | undefined;
    }

    public findCustomerByEmail(email: string): Customer | undefined {
        const keys = this.db?.getAllKeys() || [];
        for (const key of keys) {
            const customer = this.db?.findObject(key) as Customer | undefined;
            if (customer && customer.email === email) {
                return customer;
            }
        }
        return undefined;
    }

    public updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean {
        const customer = this.findCustomerById(customerId);
        if (!customer) {
            return false;
        }
        Object.assign(customer, updates);
        this.db?.saveObject(customerId, customer);
        return true;
    }

    public getAllCustomers(): Customer[] {
        const keys = this.db?.getAllKeys() || [];
        return keys.map(key => this.db?.findObject(key) as Customer);
    }
}