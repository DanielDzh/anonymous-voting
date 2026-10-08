"use client";

import { createContext, useContext, type ReactNode } from "react";

const VotingIdContext = createContext<string | null>(null);

/** The voting an admin page is editing; every admin action is called with it. */
export const VotingIdProvider = ({ votingId, children }: { votingId: string; children: ReactNode }) => (
  <VotingIdContext.Provider value={votingId}>{children}</VotingIdContext.Provider>
);

export const useVotingId = (): string => {
  const votingId = useContext(VotingIdContext);
  if (!votingId) throw new Error("useVotingId must be used inside <VotingIdProvider>");
  return votingId;
};
