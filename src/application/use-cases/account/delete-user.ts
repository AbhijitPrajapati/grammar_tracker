import type { UserRepository } from "../../ports/repositories";
import type { UserId } from "../../../domain/user";

export class DeleteUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: UserId): Promise<void> {
    await this.users.delete(userId);
  }
}
