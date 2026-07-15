import { describe, it, expect, beforeEach } from 'bun:test';
import { ProductServiceImpl } from '../src/generated/productservice.impl';
import { DBImpl } from '../src/generated/db.impl';
import { Product } from '../src/entity/product';

describe('ProductServiceImpl', () => {
    let productService: ProductServiceImpl;
    let db: DBImpl;

    beforeEach(() => {
        db = new DBImpl();
        productService = new ProductServiceImpl();
        productService.db = db;
    });

    describe('createProduct', () => {
        it('should create product successfully with valid details', () => {
            const product = productService.createProduct('Laptop', 999.99, 10, 'Electronics', 'Gaming Laptop');
            expect(product).toBeInstanceOf(Product);
            expect(product.id).toBeDefined();
            expect(product.name).toBe('Laptop');
            expect(product.price).toBe(999.99);
            expect(product.stock).toBe(10);
            expect(product.category).toBe('Electronics');
            expect(product.description).toBe('Gaming Laptop');

            const saved = db.findObject('product:' + product.id);
            expect(saved).toBe(product);
        });

        it('should throw error if name is empty', () => {
            expect(() => {
                productService.createProduct('', 100, 5, 'Category');
            }).toThrow('Product name must have length > 0');
        });

        it('should throw error if price <= 0', () => {
            expect(() => {
                productService.createProduct('Name', 0, 5, 'Category');
            }).toThrow('Product price must be > 0');

            expect(() => {
                productService.createProduct('Name', -1, 5, 'Category');
            }).toThrow('Product price must be > 0');
        });

        it('should allow price = 0.01 (edge case)', () => {
            const product = productService.createProduct('Pin', 0.01, 5, 'Office');
            expect(product.price).toBe(0.01);
        });

        it('should throw error if stock < 0', () => {
            expect(() => {
                productService.createProduct('Name', 100, -1, 'Category');
            }).toThrow('Product stock must be >= 0');
        });

        it('should allow stock = 0 (edge case, out of stock)', () => {
            const product = productService.createProduct('Out of Stock Item', 100, 0, 'Category');
            expect(product.stock).toBe(0);
        });
    });

    describe('findProductById', () => {
        it('should return product if ID exists', () => {
            const product = productService.createProduct('Laptop', 999, 10, 'Electronics');
            const found = productService.findProductById(product.id);
            expect(found).toBe(product);
        });

        it('should return undefined if ID does not exist', () => {
            const found = productService.findProductById('non-existent');
            expect(found).toBeUndefined();
        });
    });

    describe('findProductsByCategory', () => {
        it('should return matched products of category', () => {
            const prod1 = productService.createProduct('Laptop', 999, 10, 'Electronics');
            const prod2 = productService.createProduct('Phone', 500, 20, 'Electronics');
            const prod3 = productService.createProduct('Shirt', 20, 50, 'Clothing');

            const electronics = productService.findProductsByCategory('Electronics');
            expect(electronics).toContain(prod1);
            expect(electronics).toContain(prod2);
            expect(electronics).not.toContain(prod3);
            expect(electronics.length).toBe(2);
        });

        it('should return empty array if no category matches', () => {
            const found = productService.findProductsByCategory('Furniture');
            expect(found).toEqual([]);
        });
    });

    describe('updateStock', () => {
        it('should update stock successfully and return true', () => {
            const product = productService.createProduct('Laptop', 999, 10, 'Electronics');
            const result = productService.updateStock(product.id, 15);
            expect(result).toBe(true);
            expect(product.stock).toBe(15);
            const saved = productService.findProductById(product.id);
            expect(saved?.stock).toBe(15);
        });

        it('should return false if product does not exist', () => {
            const result = productService.updateStock('non-existent', 15);
            expect(result).toBe(false);
        });

        it('should throw error if new stock < 0', () => {
            const product = productService.createProduct('Laptop', 999, 10, 'Electronics');
            expect(() => {
                productService.updateStock(product.id, -1);
            }).toThrow('Stock must be >= 0');
        });
    });

    describe('reduceStock', () => {
        it('should reduce stock and return true if sufficient stock', () => {
            const product = productService.createProduct('Laptop', 999, 10, 'Electronics');
            const result = productService.reduceStock(product.id, 4);
            expect(result).toBe(true);
            expect(product.stock).toBe(6);
        });

        it('should reduce stock to exactly 0 (edge case)', () => {
            const product = productService.createProduct('Laptop', 999, 10, 'Electronics');
            const result = productService.reduceStock(product.id, 10);
            expect(result).toBe(true);
            expect(product.stock).toBe(0);
        });

        it('should return false if quantity > stock (edge case)', () => {
            const product = productService.createProduct('Laptop', 999, 10, 'Electronics');
            const result = productService.reduceStock(product.id, 11);
            expect(result).toBe(false);
            expect(product.stock).toBe(10); // remains unchanged
        });

        it('should return false if product does not exist', () => {
            const result = productService.reduceStock('non-existent', 5);
            expect(result).toBe(false);
        });

        it('should throw error if quantity <= 0', () => {
            const product = productService.createProduct('Laptop', 999, 10, 'Electronics');
            expect(() => {
                productService.reduceStock(product.id, 0);
            }).toThrow('Quantity must be > 0');

            expect(() => {
                productService.reduceStock(product.id, -2);
            }).toThrow('Quantity must be > 0');
        });
    });

    describe('getAllProducts', () => {
        it('should return all products and ignore non-product keys', () => {
            const prod1 = productService.createProduct('Laptop', 999, 10, 'Electronics');
            db.saveObject('user:alice', { name: 'Alice' }); // not product:*

            const all = productService.getAllProducts();
            expect(all).toContain(prod1);
            expect(all.length).toBe(1);
        });

        it('should return empty array if no products exist', () => {
            const all = productService.getAllProducts();
            expect(all).toEqual([]);
        });
    });
});
