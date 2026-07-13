import { UserController } from './controller/user-controller';
import { User } from './entity/user';
import { container } from './generated/container';

async function main() {
    console.log('--- AetherScript Demo ---\n');

    const userController = new UserController();
    userController.userService = container.get('UserService');
    console.log('✅ UserService injected via DI container\n');

    // Happy path
    console.log('--- Happy Path ---');
    userController.create(new User('Alice', 30));
    const found = userController.find('Alice');
    console.log('Found user:', found);

    // Validation
    console.log('\n--- Validation ---');
    try {
        userController.create(new User('Al', 30)); // name too short
    } catch (e) {
        console.log('✅ Caught expected error (name too short):', (e as Error).message);
    }

    try {
        userController.create(new User('Bob', -1)); // age invalid
    } catch (e) {
        console.log('✅ Caught expected error (age invalid):', (e as Error).message);
    }

    console.log('\n--- Done ---');
}

main();
