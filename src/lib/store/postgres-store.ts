import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { candidates, positions, votings } from "@/lib/db/schema";
import { DEFAULT_THEME, isThemeId } from "@/themes/registry";
import type { ThemeId } from "@/themes/types";
import type { LiveStats, Position, Voting, VotingStore, VotingSummary } from "./types";

type VotingRow = typeof votings.$inferSelect;

const toSummary = (row: VotingRow): VotingSummary => ({
  id: row.id,
  title: row.title,
  phase: row.phase,
  // A theme removed from the app falls back instead of breaking the page.
  theme: isThemeId(row.theme) ? (row.theme as ThemeId) : DEFAULT_THEME,
  accessCode: row.accessCode,
  ballotsCast: row.ballotsCast,
  createdAt: row.createdAt,
});

/** One SQL query: the voting with its positions and candidates, in creation order. */
const loadVoting = async (where: SQL): Promise<Voting | null> => {
  const row = await getDb().query.votings.findFirst({
    where,
    with: {
      positions: {
        orderBy: [asc(positions.createdAt), asc(positions.id)],
        with: { candidates: { orderBy: [asc(candidates.createdAt), asc(candidates.id)] } },
      },
    },
  });
  if (!row) return null;
  return {
    ...toSummary(row),
    roundId: row.roundId,
    positions: row.positions.map((position): Position => ({
      id: position.id,
      title: position.title,
      candidates: position.candidates.map(({ id, positionId, name, description, photo, votes, gamePoints }) => ({
        id,
        positionId,
        name,
        description,
        photo,
        votes,
        gamePoints,
      })),
    })),
  };
};

/** Candidate ids that belong to this voting — guards every candidate-level change. */
const candidateInVoting = (votingId: string, candidateId: string) =>
  and(
    eq(candidates.id, candidateId),
    inArray(candidates.positionId, getDb().select({ id: positions.id }).from(positions).where(eq(positions.votingId, votingId))),
  );

// Ids come from the network; a malformed uuid would make Postgres throw instead of matching nothing.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID.test(value);

export const postgresStore: VotingStore = {
  listVotings: async () => (await getDb().select().from(votings).orderBy(desc(votings.createdAt))).map(toSummary),

  createVoting: async (title, theme, accessCode) => {
    const [row] = await getDb().insert(votings).values({ title, theme, accessCode }).returning({ id: votings.id });
    return row.id;
  },

  deleteVoting: async (votingId) => {
    if (!isUuid(votingId)) return;
    // Positions, candidates and their counts go with it (ON DELETE CASCADE).
    await getDb().delete(votings).where(eq(votings.id, votingId));
  },

  getVoting: async (votingId) => (isUuid(votingId) ? loadVoting(eq(votings.id, votingId)) : null),

  findVotingByCode: async (accessCode) => loadVoting(eq(votings.accessCode, accessCode)),

  getLiveStats: async (votingId): Promise<LiveStats | null> => {
    if (!isUuid(votingId)) return null;
    // Only ids and counters — never photos — in a single SQL query.
    const row = await getDb().query.votings.findFirst({
      where: eq(votings.id, votingId),
      columns: { title: true, theme: true, phase: true, accessCode: true, ballotsCast: true },
      with: { positions: { columns: { id: true }, with: { candidates: { columns: { id: true, gamePoints: true } } } } },
    });
    if (!row) return null;
    return {
      title: row.title,
      theme: row.theme,
      phase: row.phase,
      accessCode: row.accessCode,
      ballotsCast: row.ballotsCast,
      gamePoints: Object.fromEntries(row.positions.flatMap((position) => position.candidates.map((candidate) => [candidate.id, candidate.gamePoints]))),
    };
  },

  isAccessCodeTaken: async (accessCode) => {
    const [row] = await getDb().select({ id: votings.id }).from(votings).where(eq(votings.accessCode, accessCode));
    return Boolean(row);
  },

  updateVoting: async (votingId, patch) => {
    if (!isUuid(votingId) || Object.keys(patch).length === 0) return;
    await getDb().update(votings).set(patch).where(eq(votings.id, votingId));
  },

  startNewRound: async (votingId) => {
    if (!isUuid(votingId)) return;
    await getDb().transaction(async (tx) => {
      await tx.update(votings).set({ roundId: randomUUID() }).where(eq(votings.id, votingId));
      // A new round starts the fun game tally from zero too.
      await tx
        .update(candidates)
        .set({ gamePoints: 0 })
        .where(inArray(candidates.positionId, tx.select({ id: positions.id }).from(positions).where(eq(positions.votingId, votingId))));
    });
  },

  addPosition: async (votingId, title) => {
    if (!isUuid(votingId)) return;
    await getDb().insert(positions).values({ votingId, title });
  },

  removePosition: async (votingId, positionId) => {
    if (!isUuid(votingId) || !isUuid(positionId)) return;
    await getDb()
      .delete(positions)
      .where(and(eq(positions.id, positionId), eq(positions.votingId, votingId)));
  },

  addCandidate: async (votingId, positionId, name, description) => {
    if (!isUuid(votingId) || !isUuid(positionId)) return;
    const [position] = await getDb()
      .select({ id: positions.id })
      .from(positions)
      .where(and(eq(positions.id, positionId), eq(positions.votingId, votingId)));
    if (!position) return;
    await getDb().insert(candidates).values({ positionId, name, description });
  },

  removeCandidate: async (votingId, candidateId) => {
    if (!isUuid(votingId) || !isUuid(candidateId)) return;
    await getDb().delete(candidates).where(candidateInVoting(votingId, candidateId));
  },

  setCandidatePhoto: async (votingId, candidateId, photo) => {
    if (!isUuid(votingId) || !isUuid(candidateId)) return;
    await getDb().update(candidates).set({ photo }).where(candidateInVoting(votingId, candidateId));
  },

  addGamePoints: async (votingId, entries) => {
    for (const { candidateId, points } of entries) {
      if (!isUuid(candidateId)) continue;
      await getDb()
        .update(candidates)
        .set({ gamePoints: sql`${candidates.gamePoints} + ${points}` })
        .where(candidateInVoting(votingId, candidateId));
    }
  },

  recordBallot: async (votingId, selections) => {
    const candidateIds = selections.map((selection) => selection.candidateId).filter(isUuid);
    // One transaction: either every count and the ballot counter move together, or nothing does.
    await getDb().transaction(async (tx) => {
      if (candidateIds.length > 0) {
        await tx
          .update(candidates)
          .set({ votes: sql`${candidates.votes} + 1` })
          .where(inArray(candidates.id, candidateIds));
      }
      await tx
        .update(votings)
        .set({ ballotsCast: sql`${votings.ballotsCast} + 1` })
        .where(eq(votings.id, votingId));
    });
  },
};
