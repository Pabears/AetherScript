import NodeCache from "node-cache";

// @autogen
export abstract class DB {
    protected cache = new NodeCache({ stdTTL: 0 }); // 0 means no expiration

    // Fallback/Legacy references for AI inference
    public abstract save(obj: any): void;
    public abstract find(id: string): any | undefined;

    // save any object to cache using obj.id as the key
    public abstract saveObject(obj: any): void;

    // find any object from cache by its id string
    public abstract findObject(id: string): any | undefined;

    // get all objects currently stored in the cache
    public abstract getAllObjects(): any[];
    public abstract getAll(): any[];
    public abstract findAll(): any[];

    // delete object from cache by id
    public abstract deleteObject(id: string): boolean;
}