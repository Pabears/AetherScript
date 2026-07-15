// 📋 来源: ProductService JSDoc 契约（src/service/product-service.ts）
// ⛔ 本文件编写时未读取 any impl 代码

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ProductServiceImpl } from '../src/generated/productservice.impl';
import { Product } from '../src/entity/product';

function makeMockDb() {
    const store = new Map<string, any>();
    return {
        save: mock(() => {}),
        find: mock(() => undefined),
        saveObject: mock((k: string, v: any) => { store.set(k, v); }),
        findObject: mock((k: string) => store.get(k)),
        getAllKeys: mock(() => [...store.keys()]),
        deleteObject: mock((k: string) => store.delete(k)),
    };
}

describe('ProductService 黑盒契约测试', () => {
    let mockDb: ReturnType<typeof makeMockDb>;
    let svc: ProductServiceImpl;

    beforeEach(() => {
        mockDb = makeMockDb();
        svc = new ProductServiceImpl();
        svc.db = mockDb as any;
    });

    // ─── createProduct: Happy Path ─────────────────────────────

    test('✅ [happy] 合法参数 → 返回含 id 的 Product', () => {
        // 来源: @returns 创建的 Product 对象（含生成的 id）
        const p = svc.createProduct('Laptop', 999, 10, 'Electronics');
        expect(p.id).toBeTruthy();
        expect(p.name).toBe('Laptop');
        expect(p.price).toBe(999);
        expect(p.stock).toBe(10);
    });

    test('✅ [happy] 创建后 db.saveObject 以 product: 前缀被调用', () => {
        // 来源: @description step 4: 调用 db.saveObject('product:' + productId, product)
        const p = svc.createProduct('Phone', 599, 5, 'Electronics');
        expect(mockDb.saveObject).toHaveBeenCalledWith(
            expect.stringContaining('product:'),
            expect.objectContaining({ name: 'Phone' })
        );
    });

    // ─── createProduct: @throws 覆盖 ──────────────────────────

    test('❌ [throws] name 为空 → 抛出 Error', () => {
        // 来源: @throws Error 如果 name 为空
        expect(() => svc.createProduct('', 100, 10, 'Cat')).toThrow();
    });

    test('❌ [throws] price <= 0 → 抛出 Error', () => {
        // 来源: @throws Error 如果 price <= 0
        expect(() => svc.createProduct('Item', 0, 10, 'Cat')).toThrow();
    });

    test('❌ [throws] stock < 0 → 抛出 Error', () => {
        // 来源: @throws Error 如果 stock < 0
        expect(() => svc.createProduct('Item', 100, -1, 'Cat')).toThrow();
    });

    test('❌ [throws] 验证失败时 db.saveObject 不应被调用', () => {
        // 来源: @description 副作用隔离
        try { svc.createProduct('', 100, 10, 'Cat'); } catch {}
        expect(mockDb.saveObject).not.toHaveBeenCalled();
    });

    // ─── createProduct: @edge-cases ───────────────────────────

    test('✅ [edge] stock = 0 → 合法（缺货商品）', () => {
        // 来源: @edge-cases stock = 0 → 合法（缺货商品）
        expect(() => svc.createProduct('OutOfStock', 100, 0, 'Cat')).not.toThrow();
    });

    test('✅ [edge] price = 0.01 → 合法', () => {
        // 来源: @edge-cases price = 0.01 → 合法
        expect(() => svc.createProduct('Cheap', 0.01, 1, 'Cat')).not.toThrow();
    });

    // ─── findProductById ───────────────────────────────────────

    test('✅ [happy] findProductById 找到已创建商品', () => {
        // 来源: @description step 1: 调用 db.findObject('product:' + productId)
        const p = svc.createProduct('Book', 30, 100, 'Books');
        expect(svc.findProductById(p.id)?.name).toBe('Book');
    });

    test('✅ [returns] findProductById 不存在 → undefined', () => {
        // 来源: @returns Product 对象或 undefined
        expect(svc.findProductById('ghost-id')).toBeUndefined();
    });

    // ─── findProductsByCategory ────────────────────────────────

    test('✅ [happy] findProductsByCategory 返回同类商品', () => {
        // 来源: @description step 2: 过滤 category 匹配的商品
        svc.createProduct('Laptop', 999, 5, 'Electronics');
        svc.createProduct('Phone', 499, 10, 'Electronics');
        svc.createProduct('Book', 30, 50, 'Books');
        expect(svc.findProductsByCategory('Electronics').length).toBe(2);
        expect(svc.findProductsByCategory('Books').length).toBe(1);
    });

    test('✅ [edge] 无匹配类别 → 返回空数组', () => {
        // 来源: @returns 匹配类别的商品数组
        expect(svc.findProductsByCategory('Nonexistent')).toHaveLength(0);
    });

    // ─── updateStock ───────────────────────────────────────────

    test('✅ [happy] updateStock 成功 → 返回 true', () => {
        // 来源: @returns 更新成功返回 true
        const p = svc.createProduct('Widget', 10, 5, 'Misc');
        expect(svc.updateStock(p.id, 20)).toBe(true);
    });

    test('❌ [returns] updateStock 商品不存在 → false', () => {
        // 来源: @returns 商品不存在返回 false
        expect(svc.updateStock('ghost', 10)).toBe(false);
    });

    // ─── reduceStock ───────────────────────────────────────────

    test('✅ [happy] reduceStock 库存充足 → 返回 true', () => {
        // 来源: @description step 3: 减少库存：product.stock -= quantity
        const p = svc.createProduct('Gadget', 50, 10, 'Tech');
        expect(svc.reduceStock(p.id, 3)).toBe(true);
    });

    test('✅ [edge] reduceStock 库存恰好等于 quantity → 成功，库存变 0', () => {
        // 来源: @edge-cases 库存恰好等于 quantity → 成功，库存变为 0
        const p = svc.createProduct('Rare', 200, 5, 'Limited');
        const result = svc.reduceStock(p.id, 5);
        expect(result).toBe(true);
        expect(svc.findProductById(p.id)?.stock).toBe(0);
    });

    test('❌ [returns] reduceStock 库存不足 → false', () => {
        // 来源: @edge-cases quantity > stock → 返回 false，库存不变
        const p = svc.createProduct('Scarce', 100, 3, 'Ltd');
        expect(svc.reduceStock(p.id, 10)).toBe(false);
    });

    test('❌ [returns] reduceStock 库存不足时库存不变', () => {
        // 来源: @edge-cases quantity > stock → 库存不变
        const p = svc.createProduct('Scarce2', 100, 3, 'Ltd');
        svc.reduceStock(p.id, 10);
        expect(svc.findProductById(p.id)?.stock).toBe(3);
    });

    test('❌ [returns] reduceStock 商品不存在 → false', () => {
        // 来源: @description step 1: 找不到商品返回 false
        expect(svc.reduceStock('ghost', 1)).toBe(false);
    });

    // ─── getAllProducts ────────────────────────────────────────

    test('✅ [happy] getAllProducts 返回所有创建的商品', () => {
        // 来源: @returns 所有商品数组
        svc.createProduct('A', 10, 1, 'Cat');
        svc.createProduct('B', 20, 2, 'Cat');
        expect(svc.getAllProducts().length).toBeGreaterThanOrEqual(2);
    });

    test('✅ [edge] 空 DB getAllProducts 返回空数组', () => {
        // 来源: @returns 无数据时返回空数组
        expect(svc.getAllProducts()).toHaveLength(0);
    });
});
