import { CustomerService } from "../service/customer-service";
import { DB } from "../service/db-service";
import { Customer } from "../entity/customer";
import { AutoGen } from "aesc";

export class CustomerServiceImpl extends CustomerService {
    createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        if (!name || name.length === 0) {
            throw new Error("Name is required");
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error("Invalid email format");
        }

        const existingCustomer = this.findCustomerByEmail(email);
        if (existingCustomer) {
            throw new Error("Customer with this email already exists");
        }

        const id = crypto.randomUUID();
        const customer = new Customer(id, name, email, phone, address);
        
        this.db?.saveObject(`customer:${id}`, customer);
        return customer;
    }

    findCustomerById(customerId: string): Customer | undefined {
        return this.db?.findObject(`customer:${customerId}`);
    }

    findCustomerByEmail(email: string): Customer | undefined {
        const allKeys = this.db?.getAllKeys() || [];
        for (const key of allKeys) {
            if (key.startsWith("customer:")) {
                const customer = this.db?.findObject(key);
                if (customer && customer.email === email) {
                    return customer;
                }
            }
        }
        return undefined;
    }

    updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean {
        const customer = this.findCustomerById(customerId);
        if (!customer) {
            return false;
        }

        if (updates.name !== undefined) {
            if (!updates.name || updates.name.length === 0) {
                throw new Error("Name cannot be empty");
            }
            customer.name = updates.name;
        }

        if (updates.phone !== undefined) {
            customer.phone = updates.phone;
        }

        if (updates.address !== undefined) {
            customer.address = updates.address;
        }

        this.db?.saveObject(`customer:${customerId}`, customer);
        return true;
    }

    getAllCustomers(): Customer[] {
        const allKeys = this.db?.getAllKeys() || [];
        const customers: Customer[] = [];
        
        for (const key of allKeys) {
            if (key.startsWith("customer:")) {
                const customer = this.db?.findObject(key);
                if (customer) {
                    customers.push(customer);
                }
            }
        }
        
        return customers;
    }
}