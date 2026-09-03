import { InvalidCurrentPassword } from "../../errors";
import type { PasswordHasher } from "../../ports/services";
import type {
  NewPassword,
  UserId,
  UserRepository,
} from "../../../domain/user";

export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(
    userId: UserId,
    currentPassword: string,
    newPassword: NewPassword,
  ): Promise<void> {
    const user = await this.users.getById(userId);
    if (
      user === null ||
      !(await this.passwordHasher.verify(currentPassword, user.passwordHash))
    ) {
      throw new InvalidCurrentPassword();
    }

    await this.users.updatePassword(
      userId,
      await this.passwordHasher.hash(newPassword.value),
    );
  }
}
