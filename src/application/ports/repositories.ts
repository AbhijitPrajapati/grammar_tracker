import type {
  DateRange,
  Distribution,
  TimeBucket,
  TimeSeries,
} from "@/src/domain/analytics";
import type { Analysis, MistakeCategory } from "@/src/domain/analysis";
import type { Speech, SpeechId } from "@/src/domain/speech";
import type {
  EmailAddress,
  UserAccount,
  UserId,
} from "@/src/domain/user";

export interface StoredUser {
  readonly account: UserAccount;
  readonly passwordHash: string;
}

export class EmailConflictError extends Error {
  constructor(
    message = "Normalized email already exists",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmailConflictError";
  }
}

export interface UserRepository {
  /** May throw EmailConflictError after a concurrent uniqueness collision. */
  create(email: EmailAddress, passwordHash: string): Promise<StoredUser>;
  getById(userId: UserId): Promise<StoredUser | null>;
  getByEmail(email: EmailAddress): Promise<StoredUser | null>;
  delete(userId: UserId): Promise<boolean>;
  updatePassword(
    userId: UserId,
    passwordHash: string,
  ): Promise<StoredUser | null>;
}

export interface SpeechRepository {
  create(
    userId: UserId,
    transcript: string,
    analysis: Analysis,
  ): Promise<Speech>;
  list(userId: UserId, limit: number, offset: number): Promise<readonly Speech[]>;
  deleteOwned(speechId: SpeechId, userId: UserId): Promise<boolean>;
}

export interface AnalyticsReader {
  distribution(userId: UserId, dateRange: DateRange): Promise<Distribution>;
  timeSeries(
    userId: UserId,
    dateRange: DateRange,
    mistakeCategory: MistakeCategory,
    bucket: TimeBucket,
  ): Promise<TimeSeries>;
}
