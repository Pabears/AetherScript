import { describe, it, expect, beforeEach } from "bun:test";
import { ProductServiceImpl } from "../src/generated/productservice.impl";
import { Product } from "../src/entity/product";

describe("ProductServiceImpl", () => {
    let productService: ProductServiceImpl;
    let mockDb: any;

    beforeEach(() => {
        productService = new ProductServiceImpl();
        
        // Simple object mock for DB dependency
        mockDb = {
            items: new Map<string, any>(),
            save(item: any) {
                this.items.set(item.id, item);
            },
            find(id: string) {
                return this.items.get(id);
            },
            getAll() {
                return Array.from(this.items.values());
            }
        };
        
        // Inject the mock DB into the service
        productService.db = mockDb;
    });

    describe("createProduct", () => {
        it("should create a product and save it to the database", () => {
            const product = productService.createProduct("Test Product", 99.99, 10, "Electronics", "A test product");
            
            expect(product).toBeDefined();
            expect(product).toBeInstanceOf(Product);
            expect(product.name).toBe("Test Product");
            expect(product.price).toBe(99.99);
            expect(product.stock).toBe(10);
            expect(product.category).toBe("Electronics");
            expect(product.description).toBe("A test product");
            expect(product.id).toBeDefined();

            // Verify it was saved to DB
            expect(mockDb.items.get(product.id)).toBe(product);
        });

        it("should throw an error if the product name is empty", () => {
            expect(() => {
                productService.createProduct("", 99.99, 10, "Electronics");
            }).toThrow("Product name must not be empty");
        });

        it("should throw an error if the product price is 0 or negative", () => {
            expect(() => {
                productService.createProduct("Test Product", 0, 10, "Electronics");
            }).toThrow("Product price must be greater than 0");

            expect(() => {
                productService.createProduct("Test Product", -10, 10, "Electronics");
            }).toThrow("Product price must be greater than 0");
        });

        it("should throw an error if the product stock is negative", () => {
            expect(() => {
                productService.createProduct("Test Product", 99.99, -5, "Electronics");
            }).toThrow("Product stock cannot be negative");
        });

        it("should return the product even if DB is not set", () => {
            productService.db = undefined;
            const product = productService.createProduct("No DB Product", 50, 5, "Misc");
            
            expect(product).toBeDefined();
            expect(product.name).toBe("No DB Product");
        });
    });

    describe("findProductById", () => {
        it("should return the product if found in the database", () => {
            const product = productService.createProduct("Find Me", 10, 5, "TestCategory");
            const foundProduct = productService.findProductById(product.id);
            
            expect(foundProduct).toBe(product);
        });

        it("should return undefined if the product is not found", () => {
            const foundProduct = productService.findProductById("non-existent-id");
            expect(foundProduct).toBeUndefined();
        });

        it("should return undefined if DB is not set", () => {
            productService.createProduct("Test", 10, 5, "TestCategory");
            productService.db = undefined; // Remove DB reference
            
            const foundProduct = productService.findProductById("any-id");
            expect(foundProduct).toBeUndefined();
        });
    });

    describe("findProductsByCategory", () => {
        it("should return all products that match the given category", () => {
            productService.createProduct("Prod 1", 10, 5, "CatA");
            productService.createProduct("Prod 2", 20, 5, "CatB");
            productService.createProduct("Prod 3", 30, 5, "CatA");

            const catAProducts = productService.findProductsByCategory("CatA");
            
            expect(catAProducts.length).toBe(2);
            expect(catAProducts.every(p => p.category === "CatA")).toBe(true);
        });

        it("should return an empty array if no products match the category", () => {
            productService.createProduct("Prod 1", 10, 5, "CatA");
            const catCProducts = productService.findProductsByCategory("CatC");
            
            expect(catCProducts.length).toBe(0);
        });

        it("should return an empty array if DB is not set", () => {
            productService.createProduct("Prod 1", 10, 5, "CatA");
            productService.db = undefined;
            
            const products = productService.findProductsByCategory("CatA");
            expect(products.length).toBe(0);
        });

        it("should ignore non-Product items in the database", () => {
            productService.createProduct("Prod 1", 10, 5, "CatA");
            
            // Inject a fake non-Product item into DB to test filtering
            mockDb.save({ id: "fake-1", category: "CatA", name: "Fake Item" });
            
            const products = productService.findProductsByCategory("CatA");
            expect(products.length).toBe(1); // Only the actual Product instance should be returned
            expect(products[0].name).toBe("Prod 1");
        });
    });

    describe("updateStock", () => {
        it("should update the stock and return true if product exists", () => {
            const product = productService.createProduct("Stock Prod", 10, 5, "CatA");
            const result = productService.updateStock(product.id, 20);
            
            expect(result).toBe(true);
            expect(product.stock).toBe(20);
            
            // Verify it was updated in the DB
            expect(mockDb.items.get(product.id).stock).toBe(20);
        });

        it("should return false if product does not exist", () => {
            const result = productService.updateStock("non-existent-id", 20);
            expect(result).toBe(false);
        });

        it("should still update stock if DB is not set but product is somehow found", () => {
            const product = productService.createProduct("Stock Prod", 10, 5, "CatA");
            
            // Mock findProductById to return product even without db
            productService.findProductById = (id) => id === product.id ? product : undefined;
            productService.db = undefined; // Drop DB reference
            
            const result = productService.updateStock(product.id, 50);
            expect(result).toBe(true);
            expect(product.stock).toBe(50);
        });
    });

    describe("reduceStock", () => {
        it("should reduce stock and return true if sufficient stock exists", () => {
            const product = productService.createProduct("Reduce Prod", 10, 10, "CatA");
            const result = productService.reduceStock(product.id, 4);
            
            expect(result).toBe(true);
            expect(product.stock).toBe(6);
            expect(mockDb.items.get(product.id).stock).toBe(6);
        });

        it("should return false if there is insufficient stock", () => {
            const product = productService.createProduct("Reduce Prod", 10, 5, "CatA");
            const result = productService.reduceStock(product.id, 10);
            
            expect(result).toBe(false);
            expect(product.stock).toBe(5); // Stock remains unchanged
        });

        it("should return false if product does not exist", () => {
            const result = productService.reduceStock("non-existent-id", 5);
            expect(result).toBe(false);
        });

        it("should use canFulfill method if it exists on the product", () => {
            const product = productService.createProduct("Reduce Prod", 10, 10, "CatA");
            
            // Mock canFulfill on the product instance to allow overdraw for testing
            (product as any).canFulfill = (quantity: number) => quantity <= 20; 
            
            const result = productService.reduceStock(product.id, 15);
            
            expect(result).toBe(true);
            expect(product.stock).toBe(-5); // Reduced beyond 0 because canFulfill allowed it
        });
    });

    describe("getAllProducts", () => {
        it("should return all products in the database", () => {
            productService.createProduct("Prod 1", 10, 5, "CatA");
            productService.createProduct("Prod 2", 20, 5, "CatB");
            
            const products = productService.getAllProducts();
            expect(products.length).toBe(2);
            expect(products[0]).toBeInstanceOf(Product);
            expect(products[1]).toBeInstanceOf(Product);
        });

        it("should ignore non-Product items", () => {
            productService.createProduct("Prod 1", 10, 5, "CatA");
            
            // Inject a non-Product item
            mockDb.save({ id: "fake-2", category: "CatB" });
            
            const products = productService.getAllProducts();
            expect(products.length).toBe(1);
            expect(products[0].name).toBe("Prod 1");
        });

        it("should return an empty array if DB is not set", () => {
            productService.createProduct("Prod 1", 10, 5, "CatA");
            productService.db = undefined;
            
            const products = productService.getAllProducts();
            expect(products.length).toBe(0);
        });
    });
});