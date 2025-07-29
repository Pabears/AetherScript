import { CustomerService } from "../service/customer-service";
import { DB } from "../service/db-service";
import { Customer } from "../entity/customer";
import { AutoGen } from "aesc";

export class CustomerServiceImpl extends CustomerService {
    public createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        if (name.length <= 0 || !this.validateEmail(email)) {
            throw new Error('Invalid name or email');
        }

        const customerId = crypto.randomUUID();
        const newCustomer = new Customer(customerId, name, email, phone, address);

        if (this.findCustomerByEmail(email)) {
            throw new Error('Email already exists');
        }

        this.db?.saveObject(customerId, newCustomer);
        return newCustomer;
    }

    public findCustomerById(customerId: string): Customer | undefined {
        return this.db?.findObject(customerId) as Customer | undefined;
    }

    public findCustomerByEmail(email: string): Customer | undefined {
        const allCustomers = this.getAllCustomers();
        return allCustomers.find(customer => customer.email === email);
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
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys.map(key => this.db?.findObject(key) as Customer).filter(customer => customer instanceof Customer);
    }

    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}