import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getServerEnvironment } from "../config/env";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

const globalDatabase = globalThis as typeof globalThis & {
  grammarTrackerPool?: Pool;
  grammarTrackerDatabase?: Database;
};

function getPool(): Pool {
  if (!globalDatabase.grammarTrackerPool) {
    const environment = getServerEnvironment();
    const pool = new Pool({
      connectionString: environment.databaseUrl,
      max: environment.databasePoolMax,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: process.env.NODE_ENV === "test",
    });
    attachDatabasePool(pool);
    globalDatabase.grammarTrackerPool = pool;
  }
  return globalDatabase.grammarTrackerPool;
}

export function getDatabase(): Database {
  globalDatabase.grammarTrackerDatabase ??= drizzle(getPool(), { schema });
  return globalDatabase.grammarTrackerDatabase;
}
