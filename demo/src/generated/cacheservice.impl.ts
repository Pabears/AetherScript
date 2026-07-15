import { CacheService } from '../service/cache-service';
import { User } from '../entity/user';

export class CacheServiceImpl extends CacheService {
    /**
     * 缓存用户数据
     *
     * @description
     * 1. 调用 this.redisLikeCache.set(key, user)
     *
     * @param key - 缓存 key
     * @param user - 要缓存的 User 对象
     */
    public async cacheUser(key: string, user: User): Promise<void> {
        this.redisLikeCache.set(key, user);
    }

    /**
     * 获取缓存的用户数据
     *
     * @description
     * 1. 调用 this.redisLikeCache.get<User>(key)
     * 2. 找到返回 User，否则返回 null
     *
     * @param key - 缓存 key
     * @returns User 对象或 null
     */
    public async getCachedUser(key: string): Promise<User | null> {
        const user = this.redisLikeCache.get<User>(key);
        return user !== undefined ? user : null;
    }

    /**
     * 清除指定用户缓存
     *
     * @description
     * 1. 调用 this.redisLikeCache.del(key)
     * 2. 返回删除数量 > 0
     *
     * @param key - 缓存 key
     * @returns 成功返回 true
     */
    public async clearUserCache(key: string): Promise<boolean> {
        const count = this.redisLikeCache.del(key);
        return count > 0;
    }

    /**
     * 缓存任意数据
     *
     * @description
     * 1. 调用 this.redisLikeCache.set(key, data)
     *
     * @param key - 缓存 key
     * @param data - 任意数据
     */
    public async cacheData(key: string, data: any): Promise<void> {
        this.redisLikeCache.set(key, data);
    }

    /**
     * 获取缓存的任意数据
     *
     * @description
     * 1. 调用 this.redisLikeCache.get(key)
     * 2. 返回数据，不存在返回 undefined
     *
     * @param key - 缓存 key
     * @returns 缓存的数据或 undefined
     */
    public async getCachedData(key: string): Promise<any> {
        return this.redisLikeCache.get(key);
    }

    /**
     * 清除缓存
     *
     * @description
     * 1. 调用 this.redisLikeCache.del(key)
     * 2. 返回删除数量 > 0
     *
     * @param key - 缓存 key
     * @returns 成功返回 true
     */
    public async clearCache(key: string): Promise<boolean> {
        const count = this.redisLikeCache.del(key);
        return count > 0;
    }
}
