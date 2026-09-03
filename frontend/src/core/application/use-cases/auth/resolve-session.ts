import { InvalidToken } from "../../errors";
import type { TokenService } from "../../ports/services";
import type { UserAccount, UserRepository } from "../../../domain/user";

export class ResolveSession {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UserRepository,
  ) {}

  async execute(token: string): Promise<UserAccount> {
    const userId = await this.tokens.verify(token);
    if (userId === null) throw new InvalidToken();

    const user = await this.users.getById(userId);
    if (user === null) throw new InvalidToken();
    return user.account;
  }
}
