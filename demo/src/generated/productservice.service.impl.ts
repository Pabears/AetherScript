import { ProductService } from "../service/product-service";
import { DB } from "../service/db-service";
import { Product } from "../entity/product";
import { AutoGen } from "aesc";

export class ProductServiceImpl extends ProductService {
    public createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        if (!name || name.length <= 0) {
            throw new Error("Name must not be empty");
        }
        if (price <= 0) {
            throw new Error("Price must be greater than 0");
        }
        if (stock < 0) {
            throw new Error("Stock cannot be negative");
        }

        const id = crypto.randomUUID();
        const product = new Product(id, name, price, stock, category, description);
        this.db?.saveObject(`product:${id}`, product);
        return product;
    }

    public findProductById(productId: string): Product | undefined {
        return this.db?.findObject(`product:${productId}`);
    }

    public findProductsByCategory(category: string): Product[] {
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys
            .filter(key => key.startsWith("product:"))
            .map(key => this.db?.findObject(key))
            .filter((product): product is Product => product !== undefined && product.category === category);
    }

    public updateStock(productId: string, newStock: number): boolean {
        if (newStock < 0) {
            return false;
        }
        
        const product = this.findProductById(productId);
        if (!product) {
            return false;
        }

        product.stock = newStock;
        this.db?.saveObject(`product:${productId}`, product);
        return true;
    }

    public reduceStock(productId: string, quantity: number): boolean {
        if (quantity <= 0) {
            return false;
        }
        
        const product = this.findProductById(productId);
        if (!product || !product.canFulfill(quantity)) {
            return false;
        }

        product.stock -= quantity;
        this.db?.saveObject(`product:${productId}`, product);
        return true;
    }

    public getAllProducts(): Product[] {
        const allKeys = this.db?.getAllKeys() || [];
        return allKeys
            .filter(key => key.startsWith("product:"))
            .map(key => this.db?.findObject(key))
            .filter((product): product is Product => product !== undefined);
    }
}