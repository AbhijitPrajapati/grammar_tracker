import type { RegisteredSession } from "../../contracts/auth";
import { EmailAlreadyRegistered } from "../../errors";
import type { PasswordHasher, TokenService } from "../../ports/services";
import type {
  EmailAddress,
  UserRepository,
} from "../../../domain/user";
import { EmailConflictError, type NewPassword } from "../../../domain/user";

export class RegisterAndStartSession {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(
    email: EmailAddress,
    password: NewPassword,
  ): Promise<RegisteredSession> {
    if ((await this.users.getByEmail(email)) !== null) {
      throw new EmailAlreadyRegistered();
    }

    const passwordHash = await this.passwordHasher.hash(password.value);
    let storedUser;
    try {
      storedUser = await this.users.create(email, passwordHash);
    } catch (error) {
      if (error instanceof EmailConflictError) {
        throw new EmailAlreadyRegistered({ cause: error });
      }
      throw error;
    }

    const sessionToken = await this.tokens.issue(storedUser.account.id);
    return {
      user: storedUser.account,
      session: { sessionToken, userId: storedUser.account.id },
    };
  }
}
