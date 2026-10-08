import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Anonymity invariant: the schema keeps only aggregate counts (`tallies.votes`, `votings.ballots_cast`) —
 * never who voted, when, from where, or in which order.
 */

export const votings = pgTable("votings", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  phase: text("phase", { enum: ["draft", "open", "closed", "results"] }).notNull().default("draft"),
  theme: text("theme").notNull(),
  /** Normalized shared code (no separator); unique, so a code always leads to exactly one voting. */
  accessCode: text("access_code").notNull().unique(),
  /** One run of the vote; the "already voted" cookie is scoped to it. */
  roundId: uuid("round_id").notNull().defaultRandom(),
  ballotsCast: integer("ballots_cast").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  votingId: uuid("voting_id")
    .notNull()
    .references(() => votings.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  positionId: uuid("position_id")
    .notNull()
    .references(() => positions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** Browser-compressed square JPEG as a data URL (~100 KB), or null. */
  photo: text("photo"),
  /** Aggregate count only. */
  votes: integer("votes").notNull().default(0),
  /** Fun only, not votes: every point scored for this candidate in the game themes, by everyone. */
  gamePoints: integer("game_points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations let a voting load with its positions and candidates in a single SQL query.
export const votingsRelations = relations(votings, ({ many }) => ({ positions: many(positions) }));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  voting: one(votings, { fields: [positions.votingId], references: [votings.id] }),
  candidates: many(candidates),
}));

export const candidatesRelations = relations(candidates, ({ one }) => ({
  position: one(positions, { fields: [candidates.positionId], references: [positions.id] }),
}));
