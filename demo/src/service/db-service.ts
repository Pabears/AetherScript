import { User } from "../entity/user";
import NodeCache from "node-cache";

export abstract class DB {
    protected cache = new NodeCache({ stdTTL: 0 }); // 0 means no expiration

    // save user to cache
    public abstract save(user: User): void;
    // find user from cache
    public abstract find(name: string): User | undefined;
}