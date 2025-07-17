import { CacheService } from "../service/cache-service";
import { User } from "../entity/user";
import { AutoGen } from "../decorator/autogen";

export abstract class CacheController {
    @AutoGen
    public cacheService?: CacheService;

    // 缓存用户并返回结果
    public abstract cacheUserData(userId: string, user: User): Promise<string>;
    
    // 获取缓存的用户数据
    public abstract getUserFromCache(userId: string): Promise<User | null>;
}
