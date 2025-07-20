import { UserController } from './user-controller';
import { User } from './user';
import { container } from './generated/container';
import assert from 'assert';

async function main() {
    let failedTests = 0;

    console.log('--- Application Start ---');

    // 1. Create an instance of the controller
    const userController = new UserController();

    // 2. Use the container to get the generated service implementation
    userController.userService = container.get('UserService');
    console.log('UserService has been injected into UserController.');

    // 3. Test the happy path
    console.log('\n--- Testing Happy Path ---');
    try {
        const validUser = new User('Alice', 30);
        userController.create(validUser);
        const foundUser = userController.find(validUser.name);
        assert.deepStrictEqual(foundUser, validUser, 'Happy path user should be found and be equal to the created user.');
        console.log('[SUCCESS] Happy path test passed.');
    } catch (e) {
        console.error('[FAIL] Happy path test failed:', e);
        failedTests++;
    }
    console.log('------------------------');

    // 4. Test validation and error handling
    console.log('\n--- Testing Validation ---');
    const testCases = [
        { user: new User('Al', 30), description: 'Invalid name (too short)' },
        { user: new User('ThisNameIsWayTooLongToBeValid', 30), description: 'Invalid name (too long)' },
        { user: new User('Bob', -1), description: 'Invalid age (negative)' },
        { user: new User('Charlie', 121), description: 'Invalid age (too high)' }
    ];

    for (const { user, description } of testCases) {
        try {
            // 1. Assert that creating an invalid user throws an error.
            try {
                userController.create(user);
                // If this line is reached, the function did not throw, which is a failure.
                assert.fail(`'${description}' should have thrown an error but it did not.`);
            } catch (e) {
                // An error was thrown, which is the expected behavior. The test passes.
            }

            // 2. Assert that the user who failed creation does not exist in the system.
            const foundUser = userController.find(user.name);
            assert.strictEqual(foundUser, undefined, `'${description}' should not be findable after a failed creation.`);

            console.log(`[SUCCESS] Test case '${description}' passed.`);
        } catch (e) {
            console.error(`[FAIL] Test case '${description}' failed:`, e);
            failedTests++;
        }
    }
    console.log('--------------------------');

    // 5. Final result
    console.log('\n--- Test Run Summary ---');
    if (failedTests > 0) {
        console.error(`[FAIL] ${failedTests} test(s) failed.`);
        process.exit(1);
    } else {
        console.log('[SUCCESS] All tests passed.');
        process.exit(0);
    }
}

main();