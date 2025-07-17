import { AutoGen } from "aesc";
import { Customer } from "../entity/customer";
import { CustomerService } from "../service/customer-service";

export class CustomerController {
    @AutoGen
    public customerService?: CustomerService;

    createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        return this.customerService!.createCustomer(name, email, phone, address);
    }

    getCustomer(customerId: string): Customer | undefined {
        return this.customerService!.findCustomerById(customerId);
    }

    getCustomerByEmail(email: string): Customer | undefined {
        return this.customerService!.findCustomerByEmail(email);
    }

    updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean {
        return this.customerService!.updateCustomer(customerId, updates);
    }

    getAllCustomers(): Customer[] {
        return this.customerService!.getAllCustomers();
    }
}
