import { CacheService } from "../service/cache-service";
import { User } from "../entity/user";
import { AutoGen } from "../decorator/autogen";

export abstract class CacheController {
    @AutoGen
    public cacheService?: CacheService;

    // Cache user and return result
    public abstract cacheUserData(userId: string, user: User): Promise<string>;
    
    // Get cached user data
    public abstract getUserFromCache(userId: string): Promise<User | null>;
}
