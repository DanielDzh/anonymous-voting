import { defineConfig } from "drizzle-kit";

// `npm run db:push` creates/updates the tables in the database from DATABASE_URL.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
