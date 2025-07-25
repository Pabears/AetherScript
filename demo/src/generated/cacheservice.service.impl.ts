import { CacheService } from "../service/cache-service";
import { User } from "../entity/user";
import NodeCache from "node-cache";

export class CacheServiceImpl extends CacheService {
    // Cache user data
    public async cacheUser(key: string, user: User): Promise<void> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        if (!(user instanceof User)) {
            throw new Error('Invalid user object');
        }
        this.redisLikeCache.set(key, user);
    }

    // Get cached user data
    public async getCachedUser(key: string): Promise<User | null> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        const user = this.redisLikeCache.get<User>(key);
        return user || null;
    }

    // Clear cache for specific user
    public async clearUserCache(key: string): Promise<boolean> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.redisLikeCache.del(key) > 0;
    }

    // Cache arbitrary data
    public async cacheData(key: string, data: any): Promise<void> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        this.redisLikeCache.set(key, data);
    }

    // Get cached data
    public async getCachedData(key: string): Promise<any> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.redisLikeCache.get(key);
    }

    // Clear cache
    public async clearCache(key: string): Promise<boolean> {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid key');
        }
        return this.redisLikeCache.del(key) > 0;
    }
}