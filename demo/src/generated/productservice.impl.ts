import { Product } from '../entity/product';
import { ProductService } from '../service/product-service';

export class ProductServiceImpl extends ProductService {
    /**
     * 创建新商品
     */
    public createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        if (!name || name.length === 0) {
            throw new Error('Product name cannot be empty');
        }
        if (price <= 0) {
            throw new Error('Product price must be greater than 0');
        }
        if (stock < 0) {
            throw new Error('Product stock must be non-negative');
        }

        const productId = crypto.randomUUID();
        const product = new Product(productId, name, price, stock, category, description);
        this.db!.saveObject('product:' + productId, product);
        return product;
    }

    /**
     * 按 ID 查找商品
     */
    public findProductById(productId: string): Product | undefined {
        const obj = this.db!.findObject('product:' + productId);
        if (obj) {
            return obj as Product;
        }
        return undefined;
    }

    /**
     * 按类别查找商品
     */
    public findProductsByCategory(category: string): Product[] {
        const allProducts = this.getAllProducts();
        return allProducts.filter(p => p.category === category);
    }

    /**
     * 更新库存
     */
    public updateStock(productId: string, newStock: number): boolean {
        if (newStock < 0) {
            return false;
        }
        const product = this.findProductById(productId);
        if (!product) {
            return false;
        }

        product.stock = newStock;
        this.db!.saveObject('product:' + productId, product);
        return true;
    }

    /**
     * 减少库存（下单时调用）
     */
    public reduceStock(productId: string, quantity: number): boolean {
        if (quantity <= 0) {
            return false;
        }
        const product = this.findProductById(productId);
        if (!product) {
            return false;
        }
        if (product.stock < quantity) {
            return false;
        }

        product.stock -= quantity;
        this.db!.saveObject('product:' + productId, product);
        return true;
    }

    /**
     * 获取所有商品
     */
    public getAllProducts(): Product[] {
        const keys = this.db!.getAllKeys();
        const products: Product[] = [];
        for (const key of keys) {
            if (key.startsWith('product:')) {
                const obj = this.db!.findObject(key);
                if (obj) {
                    products.push(obj as Product);
                }
            }
        }
        return products;
    }
}
