import { ProductService } from "../service/product-service";
import { DB } from "../service/db-service";
import { Product } from "../entity/product";
import { AutoGen } from "aesc";

export class ProductServiceImpl extends ProductService {
    createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        if (name.length === 0 || price <= 0 || stock < 0) {
            throw new Error('Invalid product data');
        }
        const id = crypto.randomUUID();
        const product = new Product(id, name, price, stock, category, description);
        this.db?.saveObject(id, product);
        return product;
    }

    findProductById(productId: string): Product | undefined {
        return this.db?.findObject(productId) as Product | undefined;
    }

    findProductsByCategory(category: string): Product[] {
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys
            .map(key => this.db?.findObject(key) as Product)
            .filter(product => product.category === category);
    }

    updateStock(productId: string, newStock: number): boolean {
        const product = this.findProductById(productId);
        if (!product) {
            return false;
        }
        product.stock = newStock;
        this.db?.saveObject(productId, product);
        return true;
    }

    reduceStock(productId: string, quantity: number): boolean {
        const product = this.findProductById(productId);
        if (!product || !product.canFulfill(quantity)) {
            return false;
        }
        product.stock -= quantity;
        this.db?.saveObject(productId, product);
        return true;
    }

    getAllProducts(): Product[] {
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys.map(key => this.db?.findObject(key) as Product);
    }
}