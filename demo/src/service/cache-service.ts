import { User } from "../entity/user";
import NodeCache from "node-cache";

// 使用 NodeCache 作为第三方缓存库
export abstract class CacheService {
    protected redisLikeCache = new NodeCache({ 
        stdTTL: 3600,
        checkperiod: 600,
        useClones: false 
    });

    // 缓存用户数据
    public abstract cacheUser(key: string, user: User): Promise<void>;
    
    // 获取缓存的用户数据
    public abstract getCachedUser(key: string): Promise<User | null>;
    
    // 清除特定用户的缓存
    public abstract clearUserCache(key: string): Promise<boolean>;
}
