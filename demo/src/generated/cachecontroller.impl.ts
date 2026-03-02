// Generated from src/controller/cache-controller.ts
import { CacheController } from '../controller/cache-controller';
import { CacheService } from '../service/cache-service';
import { User } from '../entity/user';

/**
 * Concrete implementation of the CacheController.
 */
export class CacheControllerImpl extends CacheController {
    /**
     * Cache user and return result
     * Uses CacheService to persist user data in cache
     */
    public override async cacheUserData(userId: string, user: User): Promise<string> {
        if (!this.cacheService) {
            return "Error: CacheService not initialized";
        }
        
        await this.cacheService.cacheUser(userId, user);
        return `User ${userId} data cached successfully`;
    }

    /**
     * Get cached user data
     * Retrieves User object from cache using the userId as key
     */
    public override async getUserFromCache(userId: string): Promise<User | null> {
        if (!this.cacheService) {
            return null;
        }
        
        return await this.cacheService.getCachedUser(userId);
    }
}