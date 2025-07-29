import { CacheService } from "../service/cache-service";
import { User } from "../entity/user";
import NodeCache from "node-cache";

export class CacheServiceImpl extends CacheService {
    public async cacheUser(key: string, user: User): Promise<void> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        if (!(user instanceof User)) {
            throw new Error('Invalid user object');
        }
        this.redisLikeCache.set(key, user);
    }

    public async getCachedUser(key: string): Promise<User | null> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        const user = this.redisLikeCache.get(key);
        return user instanceof User ? user : null;
    }

    public async clearUserCache(key: string): Promise<boolean> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.redisLikeCache.del(key) > 0;
    }

    public async cacheData(key: string, data: any): Promise<void> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        this.redisLikeCache.set(key, data);
    }

    public async getCachedData(key: string): Promise<any> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.redisLikeCache.get(key);
    }

    public async clearCache(key: string): Promise<boolean> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.redisLikeCache.del(key) > 0;
    }
}