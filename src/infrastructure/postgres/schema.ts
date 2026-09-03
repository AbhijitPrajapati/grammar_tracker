import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const citext = customType<{ data: string }>({
  dataType() {
    return "citext(320)";
  },
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: citext("email").notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("ix_users_email").on(table.email)],
);

export const speeches = pgTable(
  "speeches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    transcript: text("transcript").notNull(),
    analysis: jsonb("analysis").$type<unknown>().notNull(),
  },
  (table) => [index("ix_speeches_user_id").on(table.userId)],
);

export const mistakeFrequencies = pgTable(
  "mistake_frequencies",
  {
    speechId: uuid("speech_id")
      .notNull()
      .references(() => speeches.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 64 }).notNull(),
    opportunities: integer("opportunities").notNull(),
    occurrences: integer("occurrences").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.speechId, table.category] }),
    check(
      "ck_mistake_frequencies_valid_counts",
      sql`${table.occurrences} >= 0 AND ${table.opportunities} >= 0 AND ${table.occurrences} <= ${table.opportunities}`,
    ),
  ],
);
