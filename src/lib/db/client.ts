import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Client = ReturnType<typeof postgres>;

/**
 * One connection pool per server process, kept on globalThis so dev hot reloads reuse it instead
 * of opening new connections. Only the pool is cached: the Drizzle wrapper is rebuilt with this
 * module, so a schema change in dev is picked up without a restart.
 * Works with Neon (its connection string) and any plain Postgres.
 */
const globalForDb = globalThis as typeof globalThis & { __votingSql?: Client };

const getClient = (): Client => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — add it to .env.local (see .env.example)");
  // prepare: false — Neon's pooled endpoint (PgBouncer) doesn't support prepared statements.
  globalForDb.__votingSql ??= postgres(url, { prepare: false, max: 5 });
  return globalForDb.__votingSql;
};

let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export const getDb = () => {
  db ??= drizzle(getClient(), { schema });
  return db;
};
