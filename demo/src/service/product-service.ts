import { AutoGen } from "aesc";
import { Product } from "../entity/product";
import { DB } from "./db-service";

export abstract class ProductService {
    @AutoGen
    public db?: DB;

    // Create a new product with validation
    // 1. Validate: name length > 0, price > 0, stock >= 0
    // 2. Generate unique product ID using crypto.randomUUID()
    // 3. Save product to database
    public abstract createProduct(name: string, price: number, stock: number, category: string, description?: string): Product;

    // Find product by ID
    public abstract findProductById(productId: string): Product | undefined;

    // Find products by category
    public abstract findProductsByCategory(category: string): Product[];

    // Update product stock (for inventory management)
    // 1. Find product by ID
    // 2. Update stock quantity
    // 3. Save updated product
    public abstract updateStock(productId: string, newStock: number): boolean;

    // Reduce stock when order is placed
    // 1. Find product by ID
    // 2. Check if enough stock available
    // 3. Reduce stock by quantity
    // 4. Save updated product
    public abstract reduceStock(productId: string, quantity: number): boolean;

    // Get all products
    public abstract getAllProducts(): Product[];
}
