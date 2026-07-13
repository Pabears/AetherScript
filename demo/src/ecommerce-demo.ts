/**
 * AetherScript 电商 Demo — 完整业务流程验证
 *
 * 流程：注册客户 → 创建商品 → 下单 → 确认 → 支付 → 查看通知 → 取消另一个订单
 */
import { container } from './generated/container';
import { User } from './entity/user';

async function main() {
    console.log('='.repeat(50));
    console.log('  AetherScript E-Commerce Demo');
    console.log('='.repeat(50));

    const db = container.get('DB');
    const userService = container.get('UserService');
    const customerService = container.get('CustomerService');
    const productService = container.get('ProductService');
    const orderService = container.get('OrderService');
    const notificationService = container.get('NotificationService');

    let failures = 0;
    function check(label: string, condition: boolean) {
        if (condition) {
            console.log(`  ✅ ${label}`);
        } else {
            console.error(`  ❌ FAIL: ${label}`);
            failures++;
        }
    }

    // ── 1. UserService（简单场景）──────────────────────────────
    console.log('\n[1] UserService 基本测试');
    userService.db = db;
    userService.create(new User('Alice', 30));
    const found = userService.findByName('Alice');
    check('UserService.create + findByName', found?.name === 'Alice');

    try { userService.create(new User('Al', 25)); check('name太短应抛错', false); }
    catch { check('name太短应抛错', true); }

    try { userService.create(new User('Bob', 121)); check('age超范围应抛错', false); }
    catch { check('age超范围应抛错', true); }

    // ── 2. CustomerService ─────────────────────────────────────
    console.log('\n[2] CustomerService');
    const alice = customerService.createCustomer('Alice Chen', 'alice@example.com', '138-0000-0001', 'Shanghai');
    const bob = customerService.createCustomer('Bob Wang', 'bob@example.com');
    check('创建客户 Alice', alice.name === 'Alice Chen');
    check('创建客户 Bob', bob.name === 'Bob Wang');

    check('按 ID 查找客户', customerService.findCustomerById(alice.id)?.email === 'alice@example.com');
    check('按邮箱查找客户', customerService.findCustomerByEmail('bob@example.com')?.name === 'Bob Wang');
    check('获取所有客户数量 >= 2', customerService.getAllCustomers().length >= 2);

    customerService.updateCustomer(alice.id, { address: 'Beijing' });
    check('更新客户地址', customerService.findCustomerById(alice.id)?.address === 'Beijing');

    try { customerService.createCustomer('', 'bad@example.com'); check('空name应抛错', false); }
    catch { check('空name应抛错', true); }

    try { customerService.createCustomer('Test', 'notanemail'); check('无效email应抛错', false); }
    catch { check('无效email应抛错', true); }

    try { customerService.createCustomer('Dup', 'alice@example.com'); check('重复email应抛错', false); }
    catch { check('重复email应抛错', true); }

    // ── 3. ProductService ──────────────────────────────────────
    console.log('\n[3] ProductService');
    const laptop = productService.createProduct('MacBook Pro', 15999, 10, 'Electronics', 'Apple laptop');
    const phone = productService.createProduct('iPhone 16', 7999, 50, 'Electronics');
    const book = productService.createProduct('TypeScript Handbook', 89, 100, 'Books');
    check('创建笔记本电脑', laptop.name === 'MacBook Pro');
    check('创建手机', phone.stock === 50);
    check('创建书籍', book.price === 89);

    check('按 ID 查找商品', productService.findProductById(laptop.id)?.name === 'MacBook Pro');
    check('按类别查找（Electronics=2）', productService.findProductsByCategory('Electronics').length === 2);
    check('获取所有商品 >= 3', productService.getAllProducts().length >= 3);

    const reduced = productService.reduceStock(laptop.id, 3);
    check('减少库存 3 个', reduced && productService.findProductById(laptop.id)?.stock === 7);

    const insufficientReduce = productService.reduceStock(laptop.id, 100);
    check('库存不足返回 false', !insufficientReduce);
    check('库存不足时不改变库存', productService.findProductById(laptop.id)?.stock === 7);

    try { productService.createProduct('', 100, 10, 'test'); check('空name应抛错', false); }
    catch { check('空name应抛错', true); }
    try { productService.createProduct('Test', 0, 10, 'test'); check('price=0应抛错', false); }
    catch { check('price=0应抛错', true); }

    // ── 4. OrderService — 完整下单流程 ────────────────────────
    console.log('\n[4] OrderService — 完整流程');

    // 下单
    const order1 = orderService.createOrder(alice.id, [
        { productId: laptop.id, quantity: 1 },
        { productId: book.id, quantity: 2 },
    ]);
    check('创建订单（PENDING）', order1.status === 'PENDING');
    check('订单总金额正确', order1.totalAmount === 15999 + 89 * 2);
    check('按 ID 找到订单', orderService.findOrderById(order1.id)?.id === order1.id);
    check('按客户 ID 找到订单', orderService.findOrdersByCustomer(alice.id).length >= 1);

    // 确认
    const confirmed = await orderService.confirmOrder(order1.id);
    check('确认订单成功', confirmed);
    check('确认后库存减少', productService.findProductById(laptop.id)?.stock === 6);
    check('确认后状态为 CONFIRMED', orderService.findOrderById(order1.id)?.status === 'CONFIRMED');

    // 不能重复确认
    const doubleConfirm = await orderService.confirmOrder(order1.id);
    check('不能重复确认', !doubleConfirm);

    // 支付
    const paid = await orderService.processPayment(order1.id);
    check('支付成功', paid);
    check('支付后状态为 PAID', orderService.findOrderById(order1.id)?.status === 'PAID');

    // 不能取消已支付订单
    const cancelPaid = await orderService.cancelOrder(order1.id);
    check('不能取消已支付订单', !cancelPaid);

    // ── 5. 取消流程（PENDING → CANCELLED，不恢复库存）─────────
    console.log('\n[5] OrderService — 取消 PENDING 订单');
    const order2 = orderService.createOrder(bob.id, [{ productId: phone.id, quantity: 2 }]);
    check('创建第二个订单', order2.status === 'PENDING');
    const stockBefore = productService.findProductById(phone.id)?.stock;
    const cancelPending = await orderService.cancelOrder(order2.id);
    check('取消 PENDING 订单成功', cancelPending);
    check('PENDING 取消不恢复库存', productService.findProductById(phone.id)?.stock === stockBefore);

    // ── 6. 取消流程（CONFIRMED → CANCELLED，恢复库存）─────────
    console.log('\n[6] OrderService — 取消 CONFIRMED 订单（恢复库存）');
    const order3 = orderService.createOrder(bob.id, [{ productId: phone.id, quantity: 5 }]);
    const stockBeforeConfirm = productService.findProductById(phone.id)?.stock ?? 0;
    await orderService.confirmOrder(order3.id);
    check('确认订单3后库存减少5', productService.findProductById(phone.id)?.stock === stockBeforeConfirm - 5);
    const cancelConfirmed = await orderService.cancelOrder(order3.id);
    check('取消 CONFIRMED 订单成功', cancelConfirmed);
    check('取消后库存恢复', productService.findProductById(phone.id)?.stock === stockBeforeConfirm);

    // ── 7. 通知历史 ────────────────────────────────────────────
    console.log('\n[7] NotificationService — 通知历史');
    const history = await notificationService.getNotificationHistory(alice.id);
    check('Alice 有通知记录', history.length >= 1);
    console.log(`  📬 Alice 的通知（${history.length}条）:`);
    history.forEach(h => console.log(`    - ${h}`));

    // ── 8. 按状态查询 ───────────────────────────────────────────
    console.log('\n[8] 按状态查询订单');
    const paidOrders = orderService.getOrdersByStatus('PAID' as any);
    const cancelledOrders = orderService.getOrdersByStatus('CANCELLED' as any);
    check('PAID 状态订单数量 >= 1', paidOrders.length >= 1);
    check('CANCELLED 状态订单数量 >= 2', cancelledOrders.length >= 2);

    // ── 结果 ───────────────────────────────────────────────────
    console.log('\n' + '='.repeat(50));
    if (failures === 0) {
        console.log(`  ✅ ALL PASSED — 全部测试通过！`);
    } else {
        console.error(`  ❌ ${failures} 个测试失败`);
        process.exit(1);
    }
    console.log('='.repeat(50));
}

main().catch(err => { console.error(err); process.exit(1); });
