export abstract class DbService {
    abstract connect(): Promise<void>;
    abstract query(sql: string): Promise<any[]>;
}
