import { UserService } from "../user-service";
import { DB } from "../db-service";
import { User } from "../user";
import { AutoGen } from "aesc";

export class UserServiceImpl extends UserService {
  public create(user: User): void {
    if (3 < user.name.length && user.name.length < 15 && 0 <= user.age && user.age <= 120) {
      this.db?.save(user);
    }
  }
  
  public findByName(name: string): User | undefined {
    return this.db?.find(name);
  }
}