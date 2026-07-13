import { UserService } from '../service/user-service';
import { User } from '../entity/user';

export class UserServiceImpl extends UserService {
    public create(user: User): void {
        // 1. 验证 user.name 长度：必须满足 3 <= name.length <= 15
        // 2. 验证 user.age 范围：必须满足 0 <= age <= 120
        // 3. 如果验证失败，抛出 Error，不执行后续步骤
        if (user.name.length < 3 || user.name.length > 15) {
            throw new Error(`Invalid name length: ${user.name.length}. Must be between 3 and 15.`);
        }
        if (user.age < 0 || user.age > 120) {
            throw new Error(`Invalid age: ${user.age}. Must be between 0 and 120.`);
        }
        // 4. 调用 this.db!.save(user) 持久化用户
        this.db!.save(user);
    }

    public findByName(name: string): User | undefined {
        // 1. 调用 this.db!.find(name) 查询
        // 2. 返回结果（可能是 User 或 undefined）
        return this.db!.find(name);
    }
}
