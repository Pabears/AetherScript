import { ProductService } from '../service/product-service';
import { Product } from '../entity/product';

export class ProductServiceImpl extends ProductService {
    public createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        // 1. 验证：name.length > 0，price > 0，stock >= 0
        if (!name || name.length === 0) throw new Error('Product name cannot be empty');
        if (price <= 0) throw new Error(`Price must be > 0, got: ${price}`);
        if (stock < 0) throw new Error(`Stock must be >= 0, got: ${stock}`);
        // 2. 生成唯一 productId
        const productId = crypto.randomUUID();
        // 3. 创建 Product 对象
        const product = new Product(productId, name, price, stock, category, description);
        // 4. 保存
        this.db!.saveObject('product:' + productId, product);
        // 5. 返回
        return product;
    }

    public findProductById(productId: string): Product | undefined {
        return this.db!.findObject('product:' + productId);
    }

    public findProductsByCategory(category: string): Product[] {
        return this.getAllProducts().filter(p => p.category === category);
    }

    public updateStock(productId: string, newStock: number): boolean {
        const product = this.findProductById(productId);
        if (!product) return false;
        product.stock = newStock;
        this.db!.saveObject('product:' + productId, product);
        return true;
    }

    public reduceStock(productId: string, quantity: number): boolean {
        // 1. 找到商品
        const product = this.findProductById(productId);
        if (!product) return false;
        // 2. 检查库存充足
        if (product.stock < quantity) return false;
        // 3. 减少库存
        product.stock -= quantity;
        // 4. 保存
        this.db!.saveObject('product:' + productId, product);
        return true;
    }

    public getAllProducts(): Product[] {
        return this.db!.getAllKeys()
            .filter(k => k.startsWith('product:'))
            .map(k => this.db!.findObject(k))
            .filter((p): p is Product => p !== undefined);
    }
}
