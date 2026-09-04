import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type PostgresDatabase = NodePgDatabase<typeof schema>;

export interface PostgresDatabaseOptions {
  readonly databaseUrl: string;
  readonly poolMax: number;
}

const globalDatabase = globalThis as typeof globalThis & {
  grammarTrackerPool?: Pool;
  grammarTrackerDatabase?: PostgresDatabase;
};

function getPool(options: PostgresDatabaseOptions): Pool {
  if (!globalDatabase.grammarTrackerPool) {
    const pool = new Pool({
      connectionString: options.databaseUrl,
      max: options.poolMax,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: process.env.NODE_ENV === "test",
    });
    attachDatabasePool(pool);
    globalDatabase.grammarTrackerPool = pool;
  }
  return globalDatabase.grammarTrackerPool;
}

export function getPostgresDatabase(
  options: PostgresDatabaseOptions,
): PostgresDatabase {
  globalDatabase.grammarTrackerDatabase ??= drizzle(getPool(options), {
    schema,
  });
  return globalDatabase.grammarTrackerDatabase;
}
