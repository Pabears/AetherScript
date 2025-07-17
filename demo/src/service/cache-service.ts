import { User } from "../entity/user";
import NodeCache from "node-cache";

// Use NodeCache as third-party cache library
export abstract class CacheService {
    protected redisLikeCache = new NodeCache({ 
        stdTTL: 3600,
        checkperiod: 600,
        useClones: false 
    });

    // Cache user data
    public abstract cacheUser(key: string, user: User): Promise<void>;
    
    // Get cached user data
    public abstract getCachedUser(key: string): Promise<User | null>;
    
    // Clear cache for specific user
    public abstract clearUserCache(key: string): Promise<boolean>;
    
    // Cache arbitrary data
    public abstract cacheData(key: string, data: any): Promise<void>;
    
    // Get cached data
    public abstract getCachedData(key: string): Promise<any>;
    
    // Clear cache
    public abstract clearCache(key: string): Promise<boolean>;
}
