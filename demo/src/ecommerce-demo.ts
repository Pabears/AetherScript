import { ProductController } from './controller/product-controller';
import { CustomerController } from './controller/customer-controller';
import { OrderController } from './controller/order-controller';
import { OrderStatus } from './entity/order';
import { container } from './generated/container';
import assert from 'assert';

async function main() {
    let failedTests = 0;

    console.log('🛒 === E-commerce System Demo Start ===');

    // Initialize controllers and inject services
    const productController = new ProductController();
    const customerController = new CustomerController();
    const orderController = new OrderController();

    productController.productService = container.get('ProductService');
    customerController.customerService = container.get('CustomerService');
    orderController.orderService = container.get('OrderService');

    console.log('✅ Services injected into controllers.');

    // === Test 1: Product Management ===
    console.log('\n📦 === Testing Product Management ===');
    try {
        // Create products
        const laptop = productController.createProduct('MacBook Pro', 2999.99, 10, 'Electronics', 'High-performance laptop');
        const phone = productController.createProduct('iPhone 15', 999.99, 20, 'Electronics', 'Latest smartphone');
        const book = productController.createProduct('TypeScript Handbook', 39.99, 50, 'Books', 'Learn TypeScript');

        console.log(`📱 Created products: ${laptop.name}, ${phone.name}, ${book.name}`);

        // Test product retrieval
        const foundLaptop = productController.getProduct(laptop.id);
        assert.deepStrictEqual(foundLaptop, laptop, 'Should find created laptop');

        const electronics = productController.getProductsByCategory('Electronics');
        assert.equal(electronics.length, 2, 'Should find 2 electronics products');

        console.log('[SUCCESS] Product management tests passed.');
    } catch (e) {
        console.error('[FAIL] Product management test failed:', e);
        failedTests++;
    }

    // === Test 2: Customer Management ===
    console.log('\n👥 === Testing Customer Management ===');
    try {
        // Create customers
        const alice = customerController.createCustomer('Alice Johnson', 'alice@example.com', '+1234567890', '123 Main St');
        const bob = customerController.createCustomer('Bob Smith', 'bob@example.com', '+0987654321');

        console.log(`👤 Created customers: ${alice.name}, ${bob.name}`);

        // Test customer retrieval
        const foundAlice = customerController.getCustomerByEmail('alice@example.com');
        assert.deepStrictEqual(foundAlice, alice, 'Should find customer by email');

        // Test customer update
        const updateResult = customerController.updateCustomer(bob.id, { phone: '+1111111111', address: '456 Oak Ave' });
        assert.equal(updateResult, true, 'Should update customer successfully');

        console.log('[SUCCESS] Customer management tests passed.');
    } catch (e) {
        console.error('[FAIL] Customer management test failed:', e);
        failedTests++;
    }

    // === Test 3: Order Workflow ===
    console.log('\n📋 === Testing Complete Order Workflow ===');
    try {
        // Get created products and customers for order creation
        const allProducts = productController.getAllProducts();
        const allCustomers = customerController.getAllCustomers();
        
        assert(allProducts.length >= 3, 'Should have at least 3 products');
        assert(allCustomers.length >= 2, 'Should have at least 2 customers');

        const laptop = allProducts.find(p => p.name.includes('MacBook'));
        const phone = allProducts.find(p => p.name.includes('iPhone'));
        const customer = allCustomers[0];

        assert(laptop && phone && customer, 'Should have required products and customer');

        // Create order
        const order = orderController.createOrder(customer.id, [
            { productId: laptop.id, quantity: 1 },
            { productId: phone.id, quantity: 2 }
        ]);

        console.log(`📝 Created order ${order.id} with ${order.getItemCount()} items, total: $${order.calculateTotal()}`);
        assert.equal(order.status, OrderStatus.PENDING, 'New order should be PENDING');

        // Confirm order
        const confirmResult = orderController.confirmOrder(order.id);
        assert.equal(confirmResult, true, 'Should confirm order successfully');

        const confirmedOrder = orderController.getOrder(order.id);
        assert.equal(confirmedOrder?.status, OrderStatus.CONFIRMED, 'Order should be CONFIRMED');
        console.log('✅ Order confirmed and stock reduced');

        // Process payment
        const paymentResult = orderController.processPayment(order.id);
        assert.equal(paymentResult, true, 'Should process payment successfully');

        const paidOrder = orderController.getOrder(order.id);
        assert.equal(paidOrder?.status, OrderStatus.PAID, 'Order should be PAID');
        console.log('💳 Payment processed successfully');

        console.log('[SUCCESS] Complete order workflow tests passed.');
    } catch (e) {
        console.error('[FAIL] Order workflow test failed:', e);
        failedTests++;
    }

    // === Test 4: Order Cancellation ===
    console.log('\n❌ === Testing Order Cancellation ===');
    try {
        const allProducts = productController.getAllProducts();
        const allCustomers = customerController.getAllCustomers();
        const book = allProducts.find(p => p.category === 'Books');
        const customer = allCustomers[1];

        assert(book && customer, 'Should have book product and customer');

        // Create and immediately cancel order
        const cancelOrder = orderController.createOrder(customer.id, [
            { productId: book.id, quantity: 3 }
        ]);

        console.log(`📝 Created order ${cancelOrder.id} for cancellation test`);

        // Confirm order first
        orderController.confirmOrder(cancelOrder.id);
        console.log('✅ Order confirmed');

        // Then cancel it
        const cancelResult = orderController.cancelOrder(cancelOrder.id);
        assert.equal(cancelResult, true, 'Should cancel order successfully');

        const cancelledOrder = orderController.getOrder(cancelOrder.id);
        assert.equal(cancelledOrder?.status, OrderStatus.CANCELLED, 'Order should be CANCELLED');
        console.log('❌ Order cancelled and stock restored');

        console.log('[SUCCESS] Order cancellation tests passed.');
    } catch (e) {
        console.error('[FAIL] Order cancellation test failed:', e);
        failedTests++;
    }

    // === Test 5: Business Logic Validation ===
    console.log('\n🔍 === Testing Business Logic Validation ===');
    try {
        const allProducts = productController.getAllProducts();
        const allCustomers = customerController.getAllCustomers();
        const laptop = allProducts.find(p => p.name.includes('MacBook'));
        const customer = allCustomers[0];

        assert(laptop && customer, 'Should have laptop and customer');

        // Test invalid product creation
        try {
            productController.createProduct('', -100, -5, ''); // Invalid data
            assert.fail('Should throw error for invalid product data');
        } catch (e) {
            // Expected error
            console.log('✅ Invalid product creation properly rejected');
        }

        // Test invalid customer creation
        try {
            customerController.createCustomer('', 'invalid-email'); // Invalid email
            assert.fail('Should throw error for invalid customer data');
        } catch (e) {
            // Expected error
            console.log('✅ Invalid customer creation properly rejected');
        }

        // Test insufficient stock order
        try {
            orderController.createOrder(customer.id, [
                { productId: laptop.id, quantity: 1000 } // More than available stock
            ]);
            assert.fail('Should throw error for insufficient stock');
        } catch (e) {
            // Expected error
            console.log('✅ Insufficient stock order properly rejected');
        }

        console.log('[SUCCESS] Business logic validation tests passed.');
    } catch (e) {
        console.error('[FAIL] Business logic validation test failed:', e);
        failedTests++;
    }

    // === Summary ===
    console.log('\n📊 === Demo Summary ===');
    const allOrders = orderController.getAllOrders();
    const allProducts = productController.getAllProducts();
    const allCustomers = customerController.getAllCustomers();

    console.log(`📦 Total Products: ${allProducts.length}`);
    console.log(`👥 Total Customers: ${allCustomers.length}`);
    console.log(`📋 Total Orders: ${allOrders.length}`);

    // Show order status breakdown
    const statusCounts = Object.values(OrderStatus).reduce((acc, status) => {
        acc[status] = orderController.getOrdersByStatus(status).length;
        return acc;
    }, {} as Record<OrderStatus, number>);

    console.log('📈 Order Status Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
        if (count > 0) {
            console.log(`   ${status}: ${count}`);
        }
    });

    console.log('\n🛒 === E-commerce System Demo Complete ===');
    
    if (failedTests === 0) {
        console.log('🎉 All tests passed! The e-commerce system is working correctly.');
    } else {
        console.log(`❌ ${failedTests} test(s) failed. Please check the implementation.`);
    }

    return failedTests;
}

// Export for testing
export { main };

// Run if this is the main module
if (import.meta.main) {
    main().then(failedTests => {
        process.exit(failedTests);
    }).catch(error => {
        console.error('Demo failed with error:', error);
        process.exit(1);
    });
}
