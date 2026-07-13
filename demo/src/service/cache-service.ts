import NodeCache from 'node-cache';
import { User } from '../entity/user';

// @autogen
/**
 * CacheService — 基于 NodeCache 的通用缓存服务
 *
 * 架构约束：
 * - 使用 this.redisLikeCache（NodeCache 实例）进行缓存操作
 * - TTL = 3600s，缓存命中直接返回对象（useClones: false）
 */
export abstract class CacheService {
    protected redisLikeCache = new NodeCache({
        stdTTL: 3600,
        checkperiod: 600,
        useClones: false
    });

    /**
     * 缓存用户数据
     *
     * @description
     * 1. 调用 this.redisLikeCache.set(key, user)
     *
     * @param key - 缓存 key
     * @param user - 要缓存的 User 对象
     */
    public abstract cacheUser(key: string, user: User): Promise<void>;

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
    public abstract getCachedUser(key: string): Promise<User | null>;

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
    public abstract clearUserCache(key: string): Promise<boolean>;

    /**
     * 缓存任意数据
     *
     * @description
     * 1. 调用 this.redisLikeCache.set(key, data)
     *
     * @param key - 缓存 key
     * @param data - 任意数据
     */
    public abstract cacheData(key: string, data: any): Promise<void>;

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
    public abstract getCachedData(key: string): Promise<any>;

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
    public abstract clearCache(key: string): Promise<boolean>;
}
