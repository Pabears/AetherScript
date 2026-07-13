import { Product } from '../entity/product';
import { DB } from './db-service';

// @autogen
/**
 * ProductService — 商品管理服务
 *
 * 架构约束：
 * - 使用 DB 进行数据持久化（@AutoGen 注入）
 * - 使用 crypto.randomUUID() 生成唯一商品 ID
 * - 商品 key 前缀为 'product:'
 */
export abstract class ProductService {
    // @AutoGen
    public db?: DB;

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
     *
     * @edge-cases
     * - price = 0 → 抛出错误
     * - stock = 0 → 合法（缺货商品）
     * - price = 0.01 → 合法
     */
    public abstract createProduct(name: string, price: number, stock: number, category: string, description?: string): Product;

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
    public abstract findProductById(productId: string): Product | undefined;

    /**
     * 按类别查找商品
     *
     * @description
     * 1. 获取所有商品（getAllProducts）
     * 2. 过滤 category 匹配的商品
     * 3. 返回匹配的商品数组
     *
     * @param category - 商品类别
     * @returns 匹配类别的商品数组
     */
    public abstract findProductsByCategory(category: string): Product[];

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
    public abstract updateStock(productId: string, newStock: number): boolean;

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
     *
     * @edge-cases
     * - 库存恰好等于 quantity → 成功，库存变为 0
     * - quantity > stock → 返回 false，库存不变
     */
    public abstract reduceStock(productId: string, quantity: number): boolean;

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
    public abstract getAllProducts(): Product[];
}
