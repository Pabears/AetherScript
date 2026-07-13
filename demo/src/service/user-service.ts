import { User } from '../entity/user';
import { DB } from './db-service';

// @autogen
/**
 * UserService — 用户业务逻辑抽象层
 *
 * 架构约束：
 * - 依赖 DB 通过 @AutoGen 属性注入（不通过构造函数）
 * - 所有操作同步执行
 */
export abstract class UserService {
    // @AutoGen — 数据库依赖，由 DI 容器自动注入
    public db?: DB;

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
     *
     * @edge-cases
     * - name = 'Ab'（长度2）→ 应抛出错误
     * - name = 'Abc'（长度3）→ 合法，不应抛出
     * - name = 'A'.repeat(15)（长度15）→ 合法，不应抛出
     * - name = 'A'.repeat(16)（长度16）→ 应抛出错误
     * - age = 0 → 合法
     * - age = 120 → 合法
     * - age = -1 → 应抛出错误
     * - age = 121 → 应抛出错误
     */
    public abstract create(user: User): void;

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
    public abstract findByName(name: string): User | undefined;
}
