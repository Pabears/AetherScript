import { AutoGen } from "aesc";
import { Customer } from "../entity/customer";
import { DB } from "./db-service";

export abstract class CustomerService {
    @AutoGen
    public db?: DB;

    // Create a new customer with validation
    // 1. Validate: name length > 0, valid email format
    // 2. Generate unique customer ID using crypto.randomUUID()
    // 3. Check if email already exists
    // 4. Save customer to database
    public abstract createCustomer(name: string, email: string, phone?: string, address?: string): Customer;

    // Find customer by ID
    public abstract findCustomerById(customerId: string): Customer | undefined;

    // Find customer by email
    public abstract findCustomerByEmail(email: string): Customer | undefined;

    // Update customer information
    // 1. Find customer by ID
    // 2. Update provided fields
    // 3. Save updated customer
    public abstract updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean;

    // Get all customers
    public abstract getAllCustomers(): Customer[];
}
