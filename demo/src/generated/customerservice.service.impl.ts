import { CustomerService } from "../service/customer-service";
import { DB } from "../service/db-service";
import { Customer } from "../entity/customer";
import { AutoGen } from "aesc";

export class CustomerServiceImpl extends CustomerService {
    public createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        if (name.length <= 0 || !new Customer('', '', email).isValidEmail()) {
            throw new Error('Invalid name or email');
        }

        const customerId = crypto.randomUUID();
        const newCustomer = new Customer(customerId, name, email, phone, address);

        const allKeys = this.db?.getAllKeys() || [];
        for (const key of allKeys) {
            const customer = this.db?.findObject(key);
            if (customer && customer.email === email) {
                throw new Error('Email already exists');
            }
        }

        this.db?.saveObject(customerId, newCustomer);
        return newCustomer;
    }

    public findCustomerById(customerId: string): Customer | undefined {
        return this.db?.findObject(customerId) as Customer | undefined;
    }

    public findCustomerByEmail(email: string): Customer | undefined {
        const allKeys = this.db?.getAllKeys() || [];
        for (const key of allKeys) {
            const customer = this.db?.findObject(key) as Customer | undefined;
            if (customer && customer.email === email) {
                return customer;
            }
        }
        return undefined;
    }

    public updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean {
        const customer = this.db?.findObject(customerId) as Customer | undefined;
        if (!customer) {
            return false;
        }

        if (updates.name !== undefined) {
            customer.name = updates.name;
        }
        if (updates.phone !== undefined) {
            customer.phone = updates.phone;
        }
        if (updates.address !== undefined) {
            customer.address = updates.address;
        }

        this.db?.saveObject(customerId, customer);
        return true;
    }

    public getAllCustomers(): Customer[] {
        const allKeys = this.db?.getAllKeys() || [];
        const customers: Customer[] = [];
        for (const key of allKeys) {
            const customer = this.db?.findObject(key) as Customer | undefined;
            if (customer) {
                customers.push(customer);
            }
        }
        return customers;
    }
}