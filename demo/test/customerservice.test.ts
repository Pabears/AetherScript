import { describe, it, expect, beforeEach } from "bun:test";
import { CustomerServiceImpl } from "../src/generated/customerservice.impl";
import { Customer } from "../src/entity/customer";

describe("CustomerServiceImpl", () => {
    let customerService: CustomerServiceImpl;
    let mockDb: any;
    let mockNotificationService: any;

    beforeEach(() => {
        // Simple object mocks for dependencies
        mockDb = {
            storage: new Map<string, any>(),
            save: function(obj: any) { this.storage.set(obj.id, obj); },
            find: function(id: string) { return this.storage.get(id); },
            getAllObjects: function() { return Array.from(this.storage.values()); }
        };

        mockNotificationService = {
            isValidEmail: function(email: string) {
                return email.includes('@') && email.includes('.');
            }
        };

        customerService = new CustomerServiceImpl();
        customerService.db = mockDb;
        customerService.notificationService = mockNotificationService;
    });

    describe("createCustomer", () => {
        it("should create a customer successfully", () => {
            const customer = customerService.createCustomer("John Doe", "john@example.com", "1234567890", "123 Main St");
            
            expect(customer).toBeDefined();
            expect(customer.id).toBeDefined();
            expect(customer.name).toBe("John Doe");
            expect(customer.email).toBe("john@example.com");
            expect(customer.phone).toBe("1234567890");
            expect(customer.address).toBe("123 Main St");
            
            // Verify it was saved to the mocked DB
            expect(mockDb.find(customer.id)).toBe(customer);
        });

        it("should throw an error if name is empty", () => {
            expect(() => {
                customerService.createCustomer("", "john@example.com");
            }).toThrow("Name must have length > 0");
        });

        it("should throw an error if email format is invalid", () => {
            expect(() => {
                customerService.createCustomer("John Doe", "invalid-email");
            }).toThrow("Invalid email format");
        });

        it("should use fallback email validation if notificationService is not provided", () => {
            customerService.notificationService = undefined;
            // The fallback logic in implementation checks for ' @' and '.' 
            // We just ensure it throws on a clearly invalid email
            expect(() => {
                customerService.createCustomer("John Doe", "invalid");
            }).toThrow("Invalid email format");
        });

        it("should throw an error if email already exists", () => {
            customerService.createCustomer("John Doe", "john@example.com");
            
            expect(() => {
                customerService.createCustomer("Jane Doe", "john@example.com");
            }).toThrow("Email already exists");
        });
        
        it("should not save to DB if db is not provided", () => {
            customerService.db = undefined;
            const customer = customerService.createCustomer("John Doe", "john@example.com");
            expect(customer).toBeDefined();
            // No error should be thrown, just skips saving
        });
    });

    describe("findCustomerById", () => {
        it("should find an existing customer", () => {
            const created = customerService.createCustomer("John Doe", "john@example.com");
            const found = customerService.findCustomerById(created.id);
            
            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.name).toBe("John Doe");
        });

        it("should return undefined for a non-existent customer", () => {
            const found = customerService.findCustomerById("non-existent-id");
            expect(found).toBeUndefined();
        });

        it("should return undefined if db is not provided", () => {
            customerService.db = undefined;
            const found = customerService.findCustomerById("any-id");
            expect(found).toBeUndefined();
        });
    });

    describe("findCustomerByEmail", () => {
        it("should find an existing customer by email", () => {
            const created = customerService.createCustomer("John Doe", "john@example.com");
            const found = customerService.findCustomerByEmail("john@example.com");
            
            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
        });

        it("should return undefined for a non-existent email", () => {
            const found = customerService.findCustomerByEmail("non-existent@example.com");
            expect(found).toBeUndefined();
        });
    });

    describe("updateCustomer", () => {
        it("should update an existing customer's fields", () => {
            const customer = customerService.createCustomer("John Doe", "john@example.com", "123", "Old Address");
            
            const result = customerService.updateCustomer(customer.id, {
                name: "John Smith",
                phone: "456",
                address: "New Address"
            });
            
            expect(result).toBe(true);
            
            const updated = customerService.findCustomerById(customer.id);
            expect(updated?.name).toBe("John Smith");
            expect(updated?.phone).toBe("456");
            expect(updated?.address).toBe("New Address");
            expect(updated?.email).toBe("john@example.com"); // Should remain unchanged
        });

        it("should return false if the customer does not exist", () => {
            const result = customerService.updateCustomer("non-existent-id", { name: "John Smith" });
            expect(result).toBe(false);
        });

        it("should handle partial updates without affecting other fields", () => {
            const customer = customerService.createCustomer("John Doe", "john@example.com", "123", "Old Address");
            
            const result = customerService.updateCustomer(customer.id, {
                phone: "456"
            });
            
            expect(result).toBe(true);
            
            const updated = customerService.findCustomerById(customer.id);
            expect(updated?.name).toBe("John Doe"); // Unchanged
            expect(updated?.phone).toBe("456"); // Changed
            expect(updated?.address).toBe("Old Address"); // Unchanged
        });
        
        it("should not fail if db is not provided when updating", () => {
            const customer = customerService.createCustomer("John Doe", "john@example.com");
            
            // Remove db after creation
            customerService.db = undefined;
            
            // It will return false because findCustomerById will return undefined without a DB
            const result = customerService.updateCustomer(customer.id, { name: "John Smith" });
            expect(result).toBe(false);
        });
    });

    describe("getAllCustomers", () => {
        it("should return all customers", () => {
            customerService.createCustomer("John Doe", "john@example.com");
            customerService.createCustomer("Jane Doe", "jane@example.com");
            
            const customers = customerService.getAllCustomers();
            expect(customers.length).toBe(2);
        });

        it("should return an empty array if no customers exist", () => {
            const customers = customerService.getAllCustomers();
            expect(customers.length).toBe(0);
        });

        it("should return an empty array if db is not provided", () => {
            customerService.db = undefined;
            const customers = customerService.getAllCustomers();
            expect(customers.length).toBe(0);
        });

        it("should filter out non-customer objects from the database", () => {
            // Add a mock non-customer object directly to the db storage
            mockDb.save({ id: "product-1", name: "Product", price: 100, email: "prod@prod.com" });
            
            customerService.createCustomer("John Doe", "john@example.com");
            
            const customers = customerService.getAllCustomers();
            
            // Should only return the 1 valid customer, ignoring the product
            expect(customers.length).toBe(1);
            expect(customers[0].name).toBe("John Doe");
        });
    });
});