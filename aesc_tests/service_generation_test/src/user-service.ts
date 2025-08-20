import { AutoGen } from "aesc";
import { DbService } from "./db-service";

export class UserService {
    @AutoGen
    private dbService: DbService;

    async getUser(id: string): Promise<any> {
        await this.dbService.connect();
        const users = await this.dbService.query(`SELECT * FROM users WHERE id = '${id}'`);
        return users[0];
    }
}
