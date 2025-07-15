import { User } from "../entity/user";
import { DB } from "../service/db-service";

export class DBImpl extends DB {
  save(user: User): void {
    this.users.set(user.name, user);
  }

  find(name: string): User | undefined {
    return this.users.get(name);
  }
}