import { CacheService } from "../service/cache-service";
import { User } from "../entity/user";
import NodeCache from "node-cache";

export class CacheServiceImpl extends CacheService {
    public async cacheUser(key: string, user: User): Promise<void> {
        this.redisLikeCache.set(key, user);
    }
    
    public async getCachedUser(key: string): Promise<User | null> {
        const user = this.redisLikeCache.get(key);
        if (user !== undefined && user !== null && typeof user === 'object' && 'name' in user && 'age' in user) {
            return user as User;
        }
        return null;
    }
    
    public async clearUserCache(key: string): Promise<boolean> {
        return this.redisLikeCache.del(key) > 0;
    }
    
    public async cacheData(key: string, data: any): Promise<void> {
        this.redisLikeCache.set(key, data);
    }
    
    public async getCachedData(key: string): Promise<any> {
        return this.redisLikeCache.get(key);
    }
    
    public async clearCache(key: string): Promise<boolean> {
        return this.redisLikeCache.del(key) > 0;
    }
}