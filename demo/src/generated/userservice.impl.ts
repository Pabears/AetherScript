import { UserService } from '../service/user-service';
import { User } from '../entity/user';

export class UserServiceImpl extends UserService {
    /**
     * 创建用户
     *
     * @description
     * 实现步骤（按序执行）：
     * 1. 验证 user.name 长度：必须满足 3 <= name.length <= 15
     * 2. 验证 user.age 范围：必须满足 0 <= age <= 120
     * 3. 如果验证失败，抛出 Error，不执行后续步骤
     * 4. 调用 this.db!.save(user) 持久化用户
     *
     * @param user - 要创建的用户对象
     * @throws Error 如果 name 长度不在 [3, 15] 范围内
     * @throws Error 如果 age 不在 [0, 120] 范围内
     */
    public create(user: User): void {
        if (!user.name || user.name.length < 3 || user.name.length > 15) {
            throw new Error('Invalid username length: must be between 3 and 15 characters.');
        }
        if (user.age < 0 || user.age > 120) {
            throw new Error('Invalid age: must be between 0 and 120.');
        }
        this.db!.save(user);
    }

    /**
     * 按名字查找用户
     *
     * @description
     * 实现步骤：
     * 1. 调用 this.db!.find(name) 查询
     * 2. 返回结果（可能是 User 或 undefined）
     *
     * @param name - 用户名，区分大小写
     * @returns 找到的 User 对象，或 undefined
     */
    public findByName(name: string): User | undefined {
        return this.db!.find(name);
    }
}
