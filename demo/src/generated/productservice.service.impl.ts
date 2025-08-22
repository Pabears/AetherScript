import { ProductService } from "../service/product-service";
import { DB } from "../service/db-service";
import { Product } from "../entity/product";
import { AutoGen } from "aesc";

export class ProductServiceImpl extends ProductService {
    createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        if (name.length <= 0 || price <= 0 || stock < 0) {
            throw new Error("Invalid product data");
        }
        
        const id = crypto.randomUUID();
        const product = new Product(id, name, price, stock, category, description);
        this.db!.saveObject(`product:${id}`, product);
        return product;
    }

    findProductById(productId: string): Product | undefined {
        return this.db!.findObject(`product:${productId}`);
    }

    findProductsByCategory(category: string): Product[] {
        const allKeys = this.db!.getAllKeys();
        const products: Product[] = [];
        
        for (const key of allKeys) {
            if (key.startsWith("product:")) {
                const product = this.db!.findObject(key);
                if (product && product.category === category) {
                    products.push(product);
                }
            }
        }
        
        return products;
    }

    updateStock(productId: string, newStock: number): boolean {
        const product = this.findProductById(productId);
        if (!product) return false;
        
        if (newStock < 0) return false;
        
        product.stock = newStock;
        this.db!.saveObject(`product:${productId}`, product);
        return true;
    }

    reduceStock(productId: string, quantity: number): boolean {
        const product = this.findProductById(productId);
        if (!product || !product.canFulfill(quantity)) return false;
        
        product.stock -= quantity;
        this.db!.saveObject(`product:${productId}`, product);
        return true;
    }

    getAllProducts(): Product[] {
        const allKeys = this.db!.getAllKeys();
        const products: Product[] = [];
        
        for (const key of allKeys) {
            if (key.startsWith("product:")) {
                const product = this.db!.findObject(key);
                if (product) {
                    products.push(product);
                }
            }
        }
        
        return products;
    }
}