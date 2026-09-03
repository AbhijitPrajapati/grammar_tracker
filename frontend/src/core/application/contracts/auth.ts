import type { UserAccount, UserId } from "../../domain/user";

export interface AuthSession {
  readonly sessionToken: string;
  readonly userId: UserId;
}

export interface RegisteredSession {
  readonly user: UserAccount;
  readonly session: AuthSession;
}
