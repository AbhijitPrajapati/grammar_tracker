import type { UserId } from "../../domain/user";

export interface AuthSession {
  readonly sessionToken: string;
  readonly userId: UserId;
}
