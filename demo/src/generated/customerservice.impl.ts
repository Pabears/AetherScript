import { CustomerService } from '../service/customer-service';
import { Customer } from '../entity/customer';

export class CustomerServiceImpl extends CustomerService {
    public createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        // 1. 验证 name 长度 > 0，email 格式合法（含 @）
        if (!name || name.length === 0) {
            throw new Error('Customer name cannot be empty');
        }
        if (!email || !email.includes('@')) {
            throw new Error(`Invalid email format: ${email}`);
        }
        // 2. 使用 crypto.randomUUID() 生成唯一 customerId
        const customerId = crypto.randomUUID();
        // 3. 检查 email 是否已存在
        const existing = this.findCustomerByEmail(email);
        if (existing) {
            throw new Error(`Email already exists: ${email}`);
        }
        // 4. 创建 Customer 对象并保存
        const customer = new Customer(customerId, name, email, phone, address);
        this.db!.saveObject(customerId, customer);
        // 5. 返回创建的 Customer 对象
        return customer;
    }

    public findCustomerById(customerId: string): Customer | undefined {
        return this.db!.findObject(customerId);
    }

    public findCustomerByEmail(email: string): Customer | undefined {
        return this.getAllCustomers().find(c => c.email === email);
    }

    public updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean {
        // 1. 找到客户
        const customer = this.findCustomerById(customerId);
        if (!customer) return false;
        // 2. 合并更新字段
        if (updates.name !== undefined) customer.name = updates.name;
        if (updates.phone !== undefined) customer.phone = updates.phone;
        if (updates.address !== undefined) customer.address = updates.address;
        // 3. 保存
        this.db!.saveObject(customerId, customer);
        return true;
    }

    public getAllCustomers(): Customer[] {
        return this.db!.getAllKeys()
            .map(key => this.db!.findObject(key))
            .filter((obj): obj is Customer => obj && typeof obj.email === 'string');
    }
}
