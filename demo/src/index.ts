import { UserController } from './controller/user-controller'
import { User } from './entity/user';
import { container } from './generated/container';

console.log('--- Application Start ---');

// 1. Create an instance of the controller
const userController = new UserController();

// 2. Use the container to get the generated service implementation
// This is the "autowiring" or "injection" step
userController.userService = container.get('UserService');

console.log('UserService has been injected into UserController.');

// 3. Create some data and call the controller's method
const newUser = new User('Alice', 30);
console.log(`Calling create with user: ${newUser.name}`);
userController.create(newUser);
console.log(userController.find(newUser.name))
console.log('--- Application End ---');