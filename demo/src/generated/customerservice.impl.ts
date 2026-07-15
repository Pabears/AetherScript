import crypto from 'crypto';
import { CustomerService } from '../service/customer-service';
import { Customer } from '../entity/customer';

export class CustomerServiceImpl extends CustomerService {
    /**
     * 创建新客户
     *
     * @description
     * 1. 验证 name 长度 > 0，email 格式合法（含 @）
     * 2. 使用 crypto.randomUUID() 生成唯一 customerId
     * 3. 检查 email 是否已存在（调用 findCustomerByEmail），若存在抛出错误
     * 4. 创建 Customer 对象并调用 db.saveObject(customerId, customer) 保存
     * 5. 返回创建的 Customer 对象
     *
     * @param name - 客户名称，长度必须 > 0
     * @param email - 客户邮箱，必须包含 @
     * @param phone - 可选电话号码
     * @param address - 可选地址
     * @returns 创建的 Customer 对象（含生成的 id）
     * @throws Error 如果 name 为空或 email 格式无效
     * @throws Error 如果 email 已被其他客户使用
     */
    public createCustomer(name: string, email: string, phone?: string, address?: string): Customer {
        if (!name || name.length <= 0) {
            throw new Error('Customer name must not be empty.');
        }
        if (!email || !email.includes('@')) {
            throw new Error('Invalid email format.');
        }
        if (this.findCustomerByEmail(email)) {
            throw new Error('Email already in use.');
        }

        const customerId = crypto.randomUUID();
        const customer = new Customer(customerId, name, email, phone, address);
        this.db!.saveObject(customerId, customer);
        return customer;
    }

    /**
     * 按 ID 查找客户
     *
     * @description
     * 1. 调用 db.findObject(customerId)
     * 2. 若找到则返回 Customer，否则返回 undefined
     *
     * @param customerId - 客户 ID
     * @returns Customer 对象或 undefined
     */
    public findCustomerById(customerId: string): Customer | undefined {
        return this.db!.findObject(customerId);
    }

    /**
     * 按邮箱查找客户
     *
     * @description
     * 1. 获取所有客户（getAllCustomers）
     * 2. 找到 email 匹配 of 客户
     * 3. 返回该客户或 undefined
     *
     * @param email - 邮箱地址
     * @returns Customer 对象或 undefined
     */
    public findCustomerByEmail(email: string): Customer | undefined {
        const all = this.getAllCustomers();
        return all.find(customer => customer.email === email);
    }

    /**
     * 更新客户信息
     *
     * @description
     * 1. 通过 findCustomerById 找到客户，找不到返回 false
     * 2. 合并 updates 中提供的字段（name, phone, address）
     * 3. 调用 db.saveObject(customerId, updatedCustomer) 保存
     * 4. 返回 true
     *
     * @param customerId - 要更新的客户 ID
     * @param updates - 要更新的字段（Partial）
     * @returns 更新成功返回 true，客户不存在返回 false
     */
    public updateCustomer(customerId: string, updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>): boolean {
        const customer = this.findCustomerById(customerId);
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

        this.db!.saveObject(customerId, customer);
        return true;
    }

    /**
     * 获取所有客户
     *
     * @description
     * 1. 获取 db 中所有 key（db.getAllKeys()）
     * 2. 过滤出 Customer 类型的记录（检查对象含有 email 字段）
     * 3. 返回 Customer 数组
     *
     * @returns 所有客户的数组，无数据时返回空数组
     */
    public getAllCustomers(): Customer[] {
        const keys = this.db!.getAllKeys();
        const customers: Customer[] = [];
        for (const key of keys) {
            const obj = this.db!.findObject(key);
            if (obj && typeof obj === 'object' && 'email' in obj) {
                customers.push(obj as Customer);
            }
        }
        return customers;
    }
}
