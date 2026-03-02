// Generated from src/service/cache-service.ts
import { User } from "../entity/user";
import { CacheService } from "../service/cache-service";

/**
 * Concrete implementation of the CacheService using NodeCache.
 */
export class CacheServiceImpl extends CacheService {
    /**
     * Cache user data
     */
    public async cacheUser(key: string, user: User): Promise<void> {
        this.redisLikeCache.set(key, user);
    }

    /**
     * Get cached user data
     */
    public async getCachedUser(key: string): Promise<User | null> {
        const user = this.redisLikeCache.get<User>(key);
        return user || null;
    }

    /**
     * Clear cache for specific user
     */
    public async clearUserCache(key: string): Promise<boolean> {
        const deletedCount = this.redisLikeCache.del(key);
        return deletedCount > 0;
    }

    /**
     * Cache arbitrary data
     */
    public async cacheData(key: string, data: any): Promise<void> {
        this.redisLikeCache.set(key, data);
    }

    /**
     * Get cached data
     */
    public async getCachedData(key: string): Promise<any> {
        return this.redisLikeCache.get(key);
    }

    /**
     * Clear cache
     */
    public async clearCache(key: string): Promise<boolean> {
        const deletedCount = this.redisLikeCache.del(key);
        return deletedCount > 0;
    }
}