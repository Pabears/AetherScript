import { DB } from '../service/db-service';
import { User } from '../entity/user';

export class DBImpl extends DB {
    private storage = new Map<string, any>();

    /**
     * 保存用户到数据库
     *
     * @description
     * 1. 以 user.name 为 key，将 user 对象存入内存存储
     * 2. 如果 key 已存在，覆盖旧数据
     *
     * @param user - 要保存的用户对象，name 不能为空
     */
    public save(user: User): void {
        this.storage.set(user.name, user);
    }

    /**
     * 按名字查找用户
     *
     * @description
     * 1. 以 name 为 key 查找内存存储
     * 2. 找到则返回 User 对象，否则返回 undefined
     *
     * @param name - 用户名，区分大小写
     * @returns 找到 of User 对象，或 undefined
     */
    public find(name: string): User | undefined {
        return this.storage.get(name);
    }

    /**
     * 以任意 key 保存任意对象
     *
     * @description
     * 1. 以 key 为键，将 data 存入内存存储
     * 2. 如果 key 已存在，覆盖旧数据
     *
     * @param key - 存储键，区分大小写
     * @param data - 任意数据对象
     */
    public saveObject(key: string, data: any): void {
        this.storage.set(key, data);
    }

    /**
     * 按任意 key 查找对象
     *
     * @description
     * 1. 以 key 为键查找内存存储
     * 2. 找到则返回数据，否则返回 undefined
     *
     * @param key - 存储键
     * @returns 存储的数据，或 undefined
     */
    public findObject(key: string): any {
        return this.storage.get(key);
    }

    /**
     * 获取所有存储的 key
     *
     * @description
     * 1. 返回当前内存存储中所有 key 的数组
     *
     * @returns 所有 key 的字符串数组
     */
    public getAllKeys(): string[] {
        return Array.from(this.storage.keys());
    }

    /**
     * 删除指定 key 的对象
     *
     * @description
     * 1. 从内存存储中删除 key 对应的数据
     * 2. 存在并删除返回 true，不存在返回 false
     *
     * @param key - 要删除的键
     * @returns 删除成功返回 true，key 不存在返回 false
     */
    public deleteObject(key: string): boolean {
        return this.storage.delete(key);
    }
}
