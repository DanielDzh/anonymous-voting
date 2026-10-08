import type { Phase } from "@/lib/store/types";
import type { ThemeId } from "@/themes/types";

export type BallotCandidate = { id: string; name: string; description: string; photo: string | null };
export type BallotPosition = { id: string; title: string; candidates: BallotCandidate[] };

export type ResultCandidate = BallotCandidate & { votes: number };
export type ResultPosition = { id: string; title: string; candidates: ResultCandidate[] };

/** One voting as a voter sees it — reached through its code. */
export type PublicSnapshot = {
  /** Normalized code that opened it; the ballot is cast with it. */
  code: string;
  title: string;
  phase: Phase;
  theme: ThemeId;
  ballot: BallotPosition[];
  /** Only filled in the results phase. */
  results: ResultPosition[] | null;
  ballotsCast: number | null;
  /** This browser already has a ballot in the current round. */
  alreadyVoted: boolean;
};

/** What the home page shows: the code form, or the voting a (valid) code leads to. */
export type PublicView = { kind: "entry"; codeRejected: boolean } | { kind: "voting"; snapshot: PublicSnapshot };

export type AdminVotingRow = {
  id: string;
  title: string;
  phase: Phase;
  theme: ThemeId;
  accessCode: string;
  ballotsCast: number;
  createdAt: string;
};

export type AdminSnapshot = {
  id: string;
  title: string;
  phase: Phase;
  theme: ThemeId;
  results: ResultPosition[];
  ballotsCast: number;
  accessCode: string;
  joinUrl: string;
  qrSvg: string;
  /** Fun only, not votes: every point scored per candidate in the game themes. */
  gamePoints: { id: string; name: string; photo: string | null; points: number }[];
};

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
