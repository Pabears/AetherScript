import { UserController } from './user-controller';
import { User } from './user';
import { container } from './generated/container';

console.log('--- Simple Gen Test Start ---');

const userController = new UserController();
userController.userService = container.get('UserService');

const newUser = new User('TestUser', 25);
userController.create(newUser);

const foundUser = userController.find('TestUser');

console.assert(foundUser, 'Test Failed: User not found');
console.assert(foundUser?.name === 'TestUser', 'Test Failed: User name does not match');
console.assert(foundUser?.age === 25, 'Test Failed: User age does not match');

console.log('--- Simple Gen Test End: All assertions passed ---');
