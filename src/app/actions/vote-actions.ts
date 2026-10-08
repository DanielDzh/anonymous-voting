"use server";

import { MAX_GAME_POINTS_PER_BATCH } from "@/config/voting";
import { isWellFormedCode, normalizeCode } from "@/lib/codes";
import { store } from "@/lib/store";
import type { Position, Selection } from "@/lib/store/types";
import { hasVotedThisRound, markVotedThisRound } from "@/lib/voter-session";

const CODE_REJECTED = "Невірний код голосування";
const VOTING_NOT_OPEN = "Голосування зараз не відкрите";
const ALREADY_VOTED = "З цього пристрою вже проголосували";

/**
 * "ballot" errors are fixable on the ballot; "code" sends the voter back to the code step;
 * "voted" means this browser already has a ballot in this round.
 */
export type VoteResult = { ok: true } | { ok: false; kind: "ballot" | "code" | "voted"; error: string };

const findByCode = async (rawCode: unknown) => {
  const code = normalizeCode(String(rawCode ?? ""));
  return isWellFormedCode(code) ? store.findVotingByCode(code) : null;
};

/** The code form only checks that the code leads somewhere; the page then shows that voting in any phase. */
export const verifyCode = async (rawCode: string): Promise<VoteResult> =>
  (await findByCode(rawCode)) ? { ok: true } : { ok: false, kind: "code", error: CODE_REJECTED };

/** One choice per position, every position covered, every candidate belongs to its position. */
const isCompleteBallot = (positions: Position[], selections: Selection[]): boolean =>
  selections.length === positions.length &&
  positions.every((position) => {
    const picks = selections.filter((selection) => selection.positionId === position.id);
    return picks.length === 1 && position.candidates.some((candidate) => candidate.id === picks[0].candidateId);
  });

// Action arguments come straight from the network, so reshape before trusting them.
const sanitizeSelections = (input: unknown): Selection[] =>
  Array.isArray(input)
    ? input.map((item) => ({ positionId: String(item?.positionId ?? ""), candidateId: String(item?.candidateId ?? "") }))
    : [];

export const castBallot = async (rawCode: string, rawSelections: Selection[]): Promise<VoteResult> => {
  const voting = await findByCode(rawCode);
  if (!voting) return { ok: false, kind: "code", error: CODE_REJECTED };
  if (voting.phase !== "open") return { ok: false, kind: "code", error: VOTING_NOT_OPEN };
  if (await hasVotedThisRound(voting.id, voting.roundId)) return { ok: false, kind: "voted", error: ALREADY_VOTED };

  const selections = sanitizeSelections(rawSelections);
  if (!isCompleteBallot(voting.positions, selections)) {
    return { ok: false, kind: "ballot", error: "Оберіть кандидата на кожну посаду" };
  }

  await store.recordBallot(voting.id, selections);
  await markVotedThisRound(voting.id, voting.roundId);
  return { ok: true };
};

/**
 * Fun tally from the game themes (not votes): points a phone scored per candidate since its last
 * batch. Only while the voting is open, only for its own candidates, capped per batch.
 */
export const recordGamePoints = async (rawCode: string, rawEntries: unknown): Promise<void> => {
  const voting = await findByCode(rawCode);
  if (!voting || voting.phase !== "open" || !Array.isArray(rawEntries)) return;
  const candidateIds = new Set(voting.positions.flatMap((position) => position.candidates.map((candidate) => candidate.id)));
  let budget = MAX_GAME_POINTS_PER_BATCH;
  const entries = rawEntries.flatMap((item) => {
    const candidateId = String(item?.candidateId ?? "");
    const points = Math.min(Math.max(Math.floor(Number(item?.points) || 0), 0), budget);
    if (!candidateIds.has(candidateId) || points === 0) return [];
    budget -= points;
    return [{ candidateId, points }];
  });
  if (entries.length > 0) await store.addGamePoints(voting.id, entries);
};
