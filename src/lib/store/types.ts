import type { ThemeId } from "@/themes/types";

export type Phase = "draft" | "open" | "closed" | "results";

export type Candidate = {
  id: string;
  positionId: string;
  name: string;
  description: string;
  /** Square JPEG as a data URL, or null. */
  photo: string | null;
  /** Aggregate count only. */
  votes: number;
  /** Fun only, not votes: everyone's game points for this candidate. */
  gamePoints: number;
};

export type Position = {
  id: string;
  title: string;
  candidates: Candidate[];
};

export type Selection = {
  positionId: string;
  candidateId: string;
};

/** A row in the admin's list of votings. */
export type VotingSummary = {
  id: string;
  title: string;
  phase: Phase;
  theme: ThemeId;
  /** Normalized shared code (no separator). */
  accessCode: string;
  ballotsCast: number;
  createdAt: Date;
};

export type Voting = VotingSummary & {
  /** Identifies one run of the vote; the "already voted" cookie is scoped to it. */
  roundId: string;
  positions: Position[];
};

/** The few numbers the projector polls: small on purpose (no photos, no QR). */
export type LiveStats = {
  title: string;
  theme: string;
  phase: Phase;
  accessCode: string;
  ballotsCast: number;
  /** candidateId → fun game points. */
  gamePoints: Record<string, number>;
};

export type VotingPatch = Partial<Pick<Voting, "title" | "phase" | "theme" | "accessCode">>;

/**
 * Storage contract. Every change is scoped to one voting: ids from another voting are ignored,
 * so a stale admin tab can never edit the wrong one.
 *
 * Anonymity invariant: implementations store only aggregate counts — never
 * who voted, when, from where, or in which order.
 */
export type VotingStore = {
  listVotings: () => Promise<VotingSummary[]>;
  /** Returns the new voting's id. */
  createVoting: (title: string, theme: ThemeId, accessCode: string) => Promise<string>;
  /** Removes the voting with its positions, candidates and tallies. */
  deleteVoting: (votingId: string) => Promise<void>;

  getVoting: (votingId: string) => Promise<Voting | null>;
  /** One light query for the projector's live numbers. */
  getLiveStats: (votingId: string) => Promise<LiveStats | null>;
  findVotingByCode: (accessCode: string) => Promise<Voting | null>;
  isAccessCodeTaken: (accessCode: string) => Promise<boolean>;

  updateVoting: (votingId: string, patch: VotingPatch) => Promise<void>;
  startNewRound: (votingId: string) => Promise<void>;

  addPosition: (votingId: string, title: string) => Promise<void>;
  removePosition: (votingId: string, positionId: string) => Promise<void>;
  addCandidate: (votingId: string, positionId: string, name: string, description: string) => Promise<void>;
  removeCandidate: (votingId: string, candidateId: string) => Promise<void>;
  setCandidatePhoto: (votingId: string, candidateId: string, photo: string | null) => Promise<void>;

  /** Adds one ballot to the tallies and the ballot counter atomically. */
  recordBallot: (votingId: string, selections: Selection[]) => Promise<void>;
  /** Adds game points (fun tally, not votes) to candidates of this voting. */
  addGamePoints: (votingId: string, entries: { candidateId: string; points: number }[]) => Promise<void>;
};
