import { describe, it, expect, beforeEach } from 'bun:test';
import { CustomerServiceImpl } from '../src/generated/customerservice.impl';
import { DBImpl } from '../src/generated/db.impl';
import { Customer } from '../src/entity/customer';

describe('CustomerServiceImpl', () => {
    let customerService: CustomerServiceImpl;
    let db: DBImpl;

    beforeEach(() => {
        db = new DBImpl();
        customerService = new CustomerServiceImpl();
        customerService.db = db;
    });

    describe('createCustomer', () => {
        it('should create a customer successfully and save to db', () => {
            const customer = customerService.createCustomer('Alice', 'alice@example.com', '123456', '123 Main St');
            expect(customer).toBeInstanceOf(Customer);
            expect(customer.id).toBeDefined();
            expect(customer.name).toBe('Alice');
            expect(customer.email).toBe('alice@example.com');
            expect(customer.phone).toBe('123456');
            expect(customer.address).toBe('123 Main St');

            const saved = db.findObject(customer.id);
            expect(saved).toBe(customer);
        });

        it('should throw error if name is empty', () => {
            expect(() => {
                customerService.createCustomer('', 'alice@example.com');
            }).toThrow('Customer name must not be empty.');
        });

        it('should throw error if email is invalid (does not contain @)', () => {
            expect(() => {
                customerService.createCustomer('Alice', 'invalidemail');
            }).toThrow('Invalid email format.');
        });

        it('should throw error if email is already in use', () => {
            customerService.createCustomer('Alice', 'alice@example.com');
            expect(() => {
                customerService.createCustomer('Bob', 'alice@example.com');
            }).toThrow('Email already in use.');
        });
    });

    describe('findCustomerById', () => {
        it('should return the customer if ID exists', () => {
            const customer = customerService.createCustomer('Alice', 'alice@example.com');
            const found = customerService.findCustomerById(customer.id);
            expect(found).toBe(customer);
        });

        it('should return undefined if ID does not exist', () => {
            const found = customerService.findCustomerById('non-existent-id');
            expect(found).toBeUndefined();
        });
    });

    describe('findCustomerByEmail', () => {
        it('should return the customer if email matches', () => {
            const customer = customerService.createCustomer('Alice', 'alice@example.com');
            const found = customerService.findCustomerByEmail('alice@example.com');
            expect(found).toBe(customer);
        });

        it('should return undefined if email does not match', () => {
            customerService.createCustomer('Alice', 'alice@example.com');
            const found = customerService.findCustomerByEmail('bob@example.com');
            expect(found).toBeUndefined();
        });
    });

    describe('updateCustomer', () => {
        it('should update customer fields and return true', () => {
            const customer = customerService.createCustomer('Alice', 'alice@example.com', '123', 'St 1');
            const success = customerService.updateCustomer(customer.id, {
                name: 'Alice Updated',
                phone: '456',
                address: 'St 2'
            });

            expect(success).toBe(true);
            const updated = customerService.findCustomerById(customer.id);
            expect(updated?.name).toBe('Alice Updated');
            expect(updated?.phone).toBe('456');
            expect(updated?.address).toBe('St 2');
        });

        it('should update partial customer fields', () => {
            const customer = customerService.createCustomer('Alice', 'alice@example.com', '123', 'St 1');
            const success = customerService.updateCustomer(customer.id, {
                phone: '456'
            });

            expect(success).toBe(true);
            const updated = customerService.findCustomerById(customer.id);
            expect(updated?.name).toBe('Alice');
            expect(updated?.phone).toBe('456');
            expect(updated?.address).toBe('St 1');
        });

        it('should return false if customer to update does not exist', () => {
            const success = customerService.updateCustomer('non-existent-id', { name: 'New Name' });
            expect(success).toBe(false);
        });
    });

    describe('getAllCustomers', () => {
        it('should return all customers and ignore non-customer objects in db', () => {
            const customer1 = customerService.createCustomer('Alice', 'alice@example.com');
            const customer2 = customerService.createCustomer('Bob', 'bob@example.com');

            // Save non-customer object to DB to test filter logic
            db.saveObject('some-other-key', { name: 'Not A Customer' });

            const all = customerService.getAllCustomers();
            expect(all).toContain(customer1);
            expect(all).toContain(customer2);
            expect(all.length).toBe(2);
        });

        it('should return empty array if no customers exist', () => {
            const all = customerService.getAllCustomers();
            expect(all).toEqual([]);
        });
    });
});
