import type { StoredUser } from "@/src/core/domain/user";
import { Speech } from "@/src/core/domain/speech";
import { EmailAddress, UserAccount } from "@/src/core/domain/user";

import { analysisFromDocument } from "./analysis-document";

export interface UserPersistenceRow {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
}

export function storedUserFromRow(row: UserPersistenceRow): StoredUser {
  return {
    account: new UserAccount({
      id: row.id,
      email: new EmailAddress(row.email),
      createdAt: row.createdAt,
    }),
    passwordHash: row.passwordHash,
  };
}

export interface SpeechPersistenceRow {
  readonly id: string;
  readonly userId: string;
  readonly transcript: string;
  readonly analysis: unknown;
  readonly createdAt: Date;
}

export function speechFromRow(row: SpeechPersistenceRow): Speech {
  return new Speech({
    id: row.id,
    userId: row.userId,
    transcript: row.transcript,
    analysis: analysisFromDocument(row.analysis),
    createdAt: row.createdAt,
  });
}
