import { ProductService } from "../service/product-service";
import { DB } from "../service/db-service";
import { Product } from "../entity/product";
import { AutoGen } from "aesc";

export class ProductServiceImpl extends ProductService {
    public createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        if (name.length === 0 || price <= 0 || stock < 0) {
            throw new Error('Invalid product details');
        }
        const productId = crypto.randomUUID();
        const product = new Product(productId, name, price, stock, category, description);
        this.db?.saveObject(productId, product);
        return product;
    }

    public findProductById(productId: string): Product | undefined {
        return this.db?.findObject(productId) as Product | undefined;
    }

    public findProductsByCategory(category: string): Product[] {
        const allProducts = this.getAllProducts();
        return allProducts.filter(product => product.category === category);
    }

    public updateStock(productId: string, newStock: number): boolean {
        const product = this.findProductById(productId);
        if (!product) {
            return false;
        }
        product.stock = newStock;
        this.db?.saveObject(productId, product);
        return true;
    }

    public reduceStock(productId: string, quantity: number): boolean {
        const product = this.findProductById(productId);
        if (!product || !product.canFulfill(quantity)) {
            return false;
        }
        product.stock -= quantity;
        this.db?.saveObject(productId, product);
        return true;
    }

    public getAllProducts(): Product[] {
        const keys = this.db?.getAllKeys() || [];
        return keys.map(key => this.db?.findObject(key) as Product).filter(product => product instanceof Product);
    }
}