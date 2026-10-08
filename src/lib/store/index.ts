import { postgresStore } from "./postgres-store";
import type { VotingStore } from "./types";

export const store: VotingStore = postgresStore;

export type * from "./types";
