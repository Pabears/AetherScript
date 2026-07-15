import crypto from 'crypto';
import { ProductService } from '../service/product-service';
import { Product } from '../entity/product';

export class ProductServiceImpl extends ProductService {
    /**
     * 创建新商品
     *
     * @description
     * 1. 验证：name.length > 0，price > 0，stock >= 0
     * 2. 使用 crypto.randomUUID() 生成唯一 productId
     * 3. 创建 Product 对象
     * 4. 调用 db.saveObject('product:' + productId, product) 保存
     * 5. 返回 Product 对象
     *
     * @param name - 商品名称，长度必须 > 0
     * @param price - 价格，必须 > 0
     * @param stock - 库存，必须 >= 0
     * @param category - 商品类别
     * @param description - 可选描述
     * @returns 创建的 Product 对象（含生成的 id）
     * @throws Error 如果 name 为空、price <= 0 或 stock < 0
     */
    public createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        if (!name || name.length <= 0) {
            throw new Error('Product name must have length > 0');
        }
        if (price <= 0) {
            throw new Error('Product price must be > 0');
        }
        if (stock < 0) {
            throw new Error('Product stock must be >= 0');
        }

        const productId = crypto.randomUUID();
        const product = new Product(productId, name, price, stock, category, description);
        this.db!.saveObject('product:' + productId, product);
        return product;
    }

    /**
     * 按 ID 查找商品
     *
     * @description
     * 1. 调用 db.findObject('product:' + productId)
     * 2. 返回 Product 或 undefined
     *
     * @param productId - 商品 ID
     * @returns Product 对象或 undefined
     */
    public findProductById(productId: string): Product | undefined {
        return this.db!.findObject('product:' + productId);
    }

    /**
     * 按类别查找商品
     *
     * @description
     * 1. 获取所有商品（getAllProducts）
     * 2. 过滤 category 匹配 of 商品
     * 3. 返回匹配的商品数组
     *
     * @param category - 商品类别
     * @returns 匹配类别的商品数组
     */
    public findProductsByCategory(category: string): Product[] {
        const products = this.getAllProducts();
        return products.filter(product => product.category === category);
    }

    /**
     * 更新库存
     *
     * @description
     * 1. 通过 findProductById 找到商品，找不到返回 false
     * 2. 设置 product.stock = newStock
     * 3. 调用 db.saveObject('product:' + productId, product) 保存
     * 4. 返回 true
     *
     * @param productId - 商品 ID
     * @param newStock - 新库存数量，必须 >= 0
     * @returns 更新成功返回 true，商品不存在返回 false
     */
    public updateStock(productId: string, newStock: number): boolean {
        if (newStock < 0) {
            throw new Error('Stock must be >= 0');
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
     *
     * @description
     * 1. 通过 findProductById 找到商品，找不到返回 false
     * 2. 检查 product.stock >= quantity，否则返回 false
     * 3. 减少库存：product.stock -= quantity
     * 4. 调用 db.saveObject('product:' + productId, product) 保存
     * 5. 返回 true
     *
     * @param productId - 商品 ID
     * @param quantity - 减少数量，必须 > 0
     * @returns 成功返回 true，商品不存在或库存不足返回 false
     */
    public reduceStock(productId: string, quantity: number): boolean {
        if (quantity <= 0) {
            throw new Error('Quantity must be > 0');
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
     *
     * @description
     * 1. 调用 db.getAllKeys()
     * 2. 过滤以 'product:' 开头的 key
     * 3. 对每个 key 调用 db.findObject(key) 获取商品
     * 4. 返回 Product 数组
     *
     * @returns 所有商品数组，无数据时返回空数组
     */
    public getAllProducts(): Product[] {
        const keys = this.db!.getAllKeys();
        const productKeys = keys.filter(key => key.startsWith('product:'));
        return productKeys.map(key => this.db!.findObject(key) as Product);
    }
}
