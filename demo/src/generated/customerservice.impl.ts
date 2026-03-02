// Generated from /Users/shiheng/myproject/AetherScript/demo/src/service/customer-service.ts
import { Customer } from '../entity/customer';
import { CustomerService } from '../service/customer-service';
import { DB } from '../service/db-service';
import { NotificationService } from '../service/notification-service';
import * as crypto from 'crypto';

export class CustomerServiceImpl extends CustomerService {
    
    public createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        // 1. Validate: name length > 0
        if (!name || name.length === 0) {
            throw new Error("Name must have length > 0");
        }

        // 2. Validate valid email format (use notificationService.isValidEmail)
        if (this.notificationService) {
            if (!this.notificationService.isValidEmail(email)) {
                throw new Error("Invalid email format");
            }
        } else {
            // Fallback validation if notificationService is not injected
            if (!email.includes(' @') || !email.includes('.')) {
                throw new Error("Invalid email format");
            }
        }

        // 4. Check if email already exists (doing this before generating ID)
        if (this.findCustomerByEmail(email)) {
            throw new Error("Email already exists");
        }

        // 3. Generate unique customer ID using crypto.randomUUID()
        const customerId = crypto.randomUUID();
        
        const customer = new Customer(customerId, name, email, phone, address);

        // 5. Save customer to database
        if (this.db) {
            this.db.save(customer);
        }

        return customer;
    }

    public findCustomerById(customerId: string): Customer | undefined {
        if (!this.db) return undefined;
        return this.db.find(customerId) as Customer | undefined;
    }

    public findCustomerByEmail(email: string): Customer | undefined {
        const customers = this.getAllCustomers();
        return customers.find(c => c.email === email);
    }

    public updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean {
        // 1. Find customer by ID
        const customer = this.findCustomerById(customerId);
        if (!customer) {
            return false;
        }

        // 2. Update provided fields
        if (updates.name !== undefined) customer.name = updates.name;
        if (updates.phone !== undefined) customer.phone = updates.phone;
        if (updates.address !== undefined) customer.address = updates.address;

        // 3. Save updated customer
        if (this.db) {
            this.db.save(customer);
        }

        return true;
    }

    public getAllCustomers(): Customer[] {
        if (!this.db) return [];
        
        const allObjects = this.db.getAllObjects();
        
        // Filter out items from the generic cache that look like a Customer
        return allObjects.filter((obj: any) => 
            obj && 
            typeof obj.id === 'string' && 
            typeof obj.name === 'string' && 
            typeof obj.email === 'string' &&
            (obj.constructor?.name === 'Customer' || obj.createdAt)
        ) as Customer[];
    }
}