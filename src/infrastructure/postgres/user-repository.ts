import { eq } from "drizzle-orm";

import type { EmailAddress, UserId } from "@/src/domain/user";
import {
  EmailConflictError,
  type StoredUser,
  type UserRepository,
} from "@/src/application/ports/repositories";

import { PostgresDatabase } from "./client";
import { hasPostgresSqlState } from "./util";
import { storedUserFromRow } from "./mappers";
import { users } from "./schema";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async create(email: EmailAddress, passwordHash: string): Promise<StoredUser> {
    let returned: (typeof users.$inferSelect)[];
    try {
      returned = await this.database
        .insert(users)
        .values({ email: email.value, passwordHash })
        .returning();
    } catch (error) {
      // Detect uniqueness violation
      if (hasPostgresSqlState(error, "23505")) {
        throw new EmailConflictError(undefined, { cause: error });
      }
      throw error;
    }

    const [row] = returned;
    if (row === undefined) {
      throw new Error("Creating a user returned no row");
    }
    return storedUserFromRow(row);
  }

  async getById(userId: UserId): Promise<StoredUser | null> {
    const [row] = await this.database
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row === undefined ? null : storedUserFromRow(row);
  }

  async getByEmail(email: EmailAddress): Promise<StoredUser | null> {
    const [row] = await this.database
      .select()
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1);
    return row === undefined ? null : storedUserFromRow(row);
  }

  async delete(userId: UserId): Promise<boolean> {
    const deleted = await this.database
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return deleted.length > 0;
  }

  async updatePassword(
    userId: UserId,
    passwordHash: string,
  ): Promise<StoredUser | null> {
    const [row] = await this.database
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .returning();
    return row === undefined ? null : storedUserFromRow(row);
  }
}
