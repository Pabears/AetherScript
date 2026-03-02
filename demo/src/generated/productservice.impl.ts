// Generated from src/service/product-service.ts
import { Product } from "../entity/product";
import { DB } from "../service/db-service";
import { ProductService } from "../service/product-service";
import * as crypto from "crypto";

export class ProductServiceImpl extends ProductService {
    public createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        if (name.length === 0) {
            throw new Error("Product name must not be empty");
        }
        if (price <= 0) {
            throw new Error("Product price must be greater than 0");
        }
        if (stock < 0) {
            throw new Error("Product stock cannot be negative");
        }

        const id = crypto.randomUUID();
        const product = new Product(id, name, price, stock, category, description);

        if (this.db) {
            this.db.save(product);
        }

        return product;
    }

    public findProductById(productId: string): Product | undefined {
        if (!this.db) return undefined;
        return this.db.find(productId) as Product | undefined;
    }

    public findProductsByCategory(category: string): Product[] {
        if (!this.db) return [];
        const allItems = this.db.getAll();
        return allItems.filter((item: any) => item instanceof Product && item.category === category);
    }

    public updateStock(productId: string, newStock: number): boolean {
        const product = this.findProductById(productId);
        if (!product) {
            return false;
        }

        product.stock = newStock;
        
        if (this.db) {
            this.db.save(product);
        }
        return true;
    }

    public reduceStock(productId: string, quantity: number): boolean {
        const product = this.findProductById(productId);
        if (!product) {
            return false;
        }

        if (product.canFulfill ? product.canFulfill(quantity) : product.stock >= quantity) {
            product.stock -= quantity;
            if (this.db) {
                this.db.save(product);
            }
            return true;
        }

        return false;
    }

    public getAllProducts(): Product[] {
        if (!this.db) return [];
        const allItems = this.db.getAll();
        return allItems.filter((item: any) => item instanceof Product);
    }
}