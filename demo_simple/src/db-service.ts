import { User } from "./user";
import NodeCache from "node-cache";

export abstract class DB {
    protected cache = new NodeCache({ stdTTL: 0 }); // 0 means no expiration

    // save user to cache
    public abstract save(user: User): void;
    // find user from cache
    public abstract find(name: string): User | undefined;
    
    // save any object to cache with key
    public abstract saveObject(key: string, data: any): void;
    // find any object from cache by key
    public abstract findObject(key: string): any;
    // get all keys from cache
    public abstract getAllKeys(): string[];
    // delete object from cache
    public abstract deleteObject(key: string): boolean;
}