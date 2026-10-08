import "server-only";
import { cookies } from "next/headers";
import { VOTED_COOKIE, VOTED_COOKIE_TTL_SECONDS } from "@/config/voting";
import { isHttpsRequest } from "@/lib/request-security";

/**
 * Best-effort repeat-vote guard for the shared-code mode: one ballot per browser per voting round.
 * One cookie per voting (so voting in one never blocks another); it stores only the round id —
 * never the choice — so it doesn't weaken anonymity.
 */
const cookieName = (votingId: string) => `${VOTED_COOKIE}_${votingId.replaceAll("-", "")}`;

export const hasVotedThisRound = async (votingId: string, roundId: string): Promise<boolean> => {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName(votingId))?.value === roundId;
};

export const markVotedThisRound = async (votingId: string, roundId: string): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(votingId), roundId, {
    httpOnly: true,
    secure: await isHttpsRequest(),
    sameSite: "lax",
    path: "/",
    maxAge: VOTED_COOKIE_TTL_SECONDS,
  });
};
