import { AutoGen } from "aesc";
import { Product } from "../entity/product";
import { ProductService } from "../service/product-service";

export class ProductController {
    @AutoGen
    public productService?: ProductService;

    createProduct(name: string, price: number, stock: number, category: string, description?: string): Product {
        return this.productService!.createProduct(name, price, stock, category, description);
    }

    getProduct(productId: string): Product | undefined {
        return this.productService!.findProductById(productId);
    }

    getProductsByCategory(category: string): Product[] {
        return this.productService!.findProductsByCategory(category);
    }

    getAllProducts(): Product[] {
        return this.productService!.getAllProducts();
    }

    updateStock(productId: string, newStock: number): boolean {
        return this.productService!.updateStock(productId, newStock);
    }
}
