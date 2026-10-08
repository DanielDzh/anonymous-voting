import "server-only";
import { connection } from "next/server";
import { isWellFormedCode, normalizeCode } from "@/lib/codes";
import { buildJoinUrl, renderQrSvg } from "@/lib/join-link";
import { store } from "@/lib/store";
import type { Position } from "@/lib/store/types";
import type { AdminSnapshot, AdminVotingRow, BallotPosition, PublicView, ResultPosition } from "@/lib/view-models";
import { hasVotedThisRound } from "@/lib/voter-session";

const toBallot = (positions: Position[]): BallotPosition[] =>
  positions.map(({ id, title, candidates }) => ({
    id,
    title,
    candidates: candidates.map(({ id: candidateId, name, description, photo }) => ({ id: candidateId, name, description, photo })),
  }));

const toResults = (positions: Position[]): ResultPosition[] =>
  positions.map(({ id, title, candidates }) => ({
    id,
    title,
    candidates: candidates.map(({ id: candidateId, name, description, photo, votes }) => ({
      id: candidateId,
      name,
      description,
      photo,
      votes,
    })),
  }));

// connection(): always render per request — the data lives in the database, not in the build.
export const getPublicView = async (linkCode: string | null): Promise<PublicView> => {
  await connection();
  const code = linkCode ? normalizeCode(linkCode) : null;
  if (!code) return { kind: "entry", codeRejected: false };

  const voting = isWellFormedCode(code) ? await store.findVotingByCode(code) : null;
  if (!voting) return { kind: "entry", codeRejected: true };

  const base = {
    code,
    title: voting.title,
    phase: voting.phase,
    theme: voting.theme,
    ballot: [],
    results: null,
    ballotsCast: null,
    alreadyVoted: false,
  };
  if (voting.phase === "results") {
    return { kind: "voting", snapshot: { ...base, results: toResults(voting.positions), ballotsCast: voting.ballotsCast } };
  }
  if (voting.phase !== "open") return { kind: "voting", snapshot: base };

  return {
    kind: "voting",
    snapshot: {
      ...base,
      ballot: toBallot(voting.positions),
      alreadyVoted: await hasVotedThisRound(voting.id, voting.roundId),
    },
  };
};

export const getAdminVotingList = async (): Promise<AdminVotingRow[]> => {
  await connection();
  return (await store.listVotings()).map((voting) => ({ ...voting, createdAt: voting.createdAt.toISOString() }));
};

/** null when there's no such voting (deleted, or a bad id in the URL). */
export const getAdminSnapshot = async (votingId: string): Promise<AdminSnapshot | null> => {
  await connection();
  const voting = await store.getVoting(votingId);
  if (!voting) return null;
  const joinUrl = await buildJoinUrl(voting.accessCode);

  return {
    id: voting.id,
    title: voting.title,
    phase: voting.phase,
    theme: voting.theme,
    results: toResults(voting.positions),
    ballotsCast: voting.ballotsCast,
    accessCode: voting.accessCode,
    joinUrl,
    qrSvg: await renderQrSvg(joinUrl),
    gamePoints: voting.positions.flatMap((position) =>
      position.candidates.map(({ id, name, photo, gamePoints }) => ({ id, name, photo, points: gamePoints })),
    ),
  };
};
