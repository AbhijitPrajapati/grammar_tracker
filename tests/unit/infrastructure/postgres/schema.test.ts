import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  mistakeFrequencies,
  speeches,
  users,
} from "@/src/infrastructure/postgres/schema";

function columnContract(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => ({
    name: column.name,
    type: column.getSQLType(),
    notNull: column.notNull,
    hasDefault: column.hasDefault,
  }));
}

describe("immutable production database mapping", () => {
  it("maps users without changing a column name, SQL type, or default", () => {
    expect(columnContract(users)).toEqual([
      { name: "id", type: "uuid", notNull: true, hasDefault: true },
      { name: "email", type: "citext(320)", notNull: true, hasDefault: false },
      {
        name: "password_hash",
        type: "varchar(255)",
        notNull: true,
        hasDefault: false,
      },
      {
        name: "created_at",
        type: "timestamp with time zone",
        notNull: true,
        hasDefault: true,
      },
    ]);
  });

  it("maps speeches and the existing frequency projection exactly", () => {
    expect(columnContract(speeches)).toEqual([
      { name: "id", type: "uuid", notNull: true, hasDefault: true },
      { name: "user_id", type: "uuid", notNull: true, hasDefault: false },
      {
        name: "created_at",
        type: "timestamp with time zone",
        notNull: true,
        hasDefault: true,
      },
      { name: "transcript", type: "text", notNull: true, hasDefault: false },
      { name: "analysis", type: "jsonb", notNull: true, hasDefault: false },
    ]);
    expect(columnContract(mistakeFrequencies)).toEqual([
      { name: "speech_id", type: "uuid", notNull: true, hasDefault: false },
      {
        name: "category",
        type: "varchar(64)",
        notNull: true,
        hasDefault: false,
      },
      {
        name: "opportunities",
        type: "integer",
        notNull: true,
        hasDefault: false,
      },
      {
        name: "occurrences",
        type: "integer",
        notNull: true,
        hasDefault: false,
      },
    ]);
  });

  it("keeps the disposable database fixture pinned to the live Alembic head", () => {
    const sql = readFileSync(
      new URL("../../../../localdb/bootstrap.sql", import.meta.url),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(sql.match(/CREATE TABLE /g)).toHaveLength(4);
    expect(sql).toContain("email citext(320) NOT NULL");
    expect(sql).toContain("analysis jsonb NOT NULL");
    expect(sql).toContain(
      "CONSTRAINT mistake_frequencies_pkey PRIMARY KEY (speech_id, category)",
    );
    expect(sql).toContain(
      "occurrences >= 0 AND opportunities >= 0 AND occurrences <= opportunities",
    );
    expect(sql).toContain(
      "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
    );
    expect(sql).toContain(
      "FOREIGN KEY (speech_id) REFERENCES speeches(id) ON DELETE CASCADE",
    );
    expect(sql).toContain(
      "INSERT INTO alembic_version (version_num) VALUES ('9b8ea2f7c1d0')",
    );
  });
});
