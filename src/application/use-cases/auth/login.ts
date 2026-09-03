import type { AuthSession } from "../../contracts/auth";
import { InvalidCredentials } from "../../errors";
import type { UserRepository } from "../../ports/repositories";
import type { PasswordHasher, TokenService } from "../../ports/services";
import type { EmailAddress } from "../../../domain/user";

export class Login {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(email: EmailAddress, password: string): Promise<AuthSession> {
    const user = await this.users.getByEmail(email);
    if (
      user === null ||
      !(await this.passwordHasher.verify(password, user.passwordHash))
    ) {
      throw new InvalidCredentials();
    }

    return {
      sessionToken: await this.tokens.issue(user.account.id),
      userId: user.account.id,
    };
  }
}
