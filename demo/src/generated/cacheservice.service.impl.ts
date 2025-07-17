import { User } from "../entity/user";
import { CacheService } from "../service/cache-service";

export class CacheServiceImpl extends CacheService {
    // 缓存用户数据
    public async cacheUser(key: string, user: User): Promise<void> {
        this.redisLikeCache.set(key, user);
    }
    
    // 获取缓存的用户数据
    public async getCachedUser(key: string): Promise<User | null> {
        const user = this.redisLikeCache.get(key) as User;
        return user || null;
    }
    
    // 清除特定用户的缓存
    public async clearUserCache(key: string): Promise<boolean> {
        const result = this.redisLikeCache.del(key);
        return result > 0;
    }
}