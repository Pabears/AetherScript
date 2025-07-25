import { container } from './src/generated/container';
import { ProductController } from './src/controller/product-controller';

console.log('🔍 === Debugging Dependency Injection ===');

// Test container
console.log('1. Testing container.get()...');
const productService = container.get('ProductService');
const dbService = container.get('DB');

console.log('ProductService:', productService);
console.log('ProductService.db:', productService.db);
console.log('DB Service:', dbService);

// Test direct service usage
console.log('\n2. Testing direct service usage...');
try {
    const product = productService.createProduct('Test Product', 99.99, 10, 'Test', 'Test description');
    console.log('Created product:', product);
    
    const foundProduct = productService.findProductById(product.id);
    console.log('Found product:', foundProduct);
    
    if (foundProduct) {
        console.log('✅ Direct service usage works!');
    } else {
        console.log('❌ Direct service usage failed - product not found');
    }
} catch (error) {
    console.error('❌ Direct service usage failed:', error);
}

// Test controller usage
console.log('\n3. Testing controller usage...');
const productController = new ProductController();
productController.productService = container.get('ProductService');

console.log('Controller productService:', productController.productService);
console.log('Controller productService.db:', productController.productService?.db);

try {
    const product = productController.createProduct('Controller Test', 199.99, 5, 'Test', 'Controller test');
    console.log('Controller created product:', product);
    
    const foundProduct = productController.getProduct(product.id);
    console.log('Controller found product:', foundProduct);
    
    if (foundProduct) {
        console.log('✅ Controller usage works!');
    } else {
        console.log('❌ Controller usage failed - product not found');
    }
} catch (error) {
    console.error('❌ Controller usage failed:', error);
}
