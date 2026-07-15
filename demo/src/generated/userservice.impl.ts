import { User } from '../entity/user';
import { UserService } from '../service/user-service';

export class UserServiceImpl extends UserService {
    /**
     * 创建用户
     */
    public create(user: User): void {
        if (!user.name || user.name.length < 3 || user.name.length > 15) {
            throw new Error('Name length must be between 3 and 15');
        }
        if (user.age < 0 || user.age > 120) {
            throw new Error('Age must be between 0 and 120');
        }
        this.db!.save(user);
    }

    /**
     * 按名字查找用户
     */
    public findByName(name: string): User | undefined {
        return this.db!.find(name);
    }
}
