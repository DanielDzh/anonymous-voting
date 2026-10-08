"use client";

import { useEffect } from "react";
import { recordGamePoints } from "@/app/actions/vote-actions";
import { GAME_POINT_EVENT, GAME_POINTS_FLUSH_MS } from "@/config/visuals";

/**
 * Sends this phone's game points (fun tally for the projector, not votes) to the server in small
 * batches: a game can score many points a second, one request each would be wasteful.
 */
export const useGamePointsSync = (code: string) => {
  useEffect(() => {
    const pending = new Map<string, number>();

    const handlePoint = (event: Event) => {
      const { candidateId, points } = (event as CustomEvent<{ candidateId: string; points: number }>).detail;
      pending.set(candidateId, (pending.get(candidateId) ?? 0) + points);
    };
    const flush = () => {
      if (pending.size === 0) return;
      const entries = [...pending].map(([candidateId, points]) => ({ candidateId, points }));
      pending.clear();
      // Fun only: a lost batch isn't worth retrying.
      recordGamePoints(code, entries).catch(() => undefined);
    };

    window.addEventListener(GAME_POINT_EVENT, handlePoint);
    const timer = window.setInterval(flush, GAME_POINTS_FLUSH_MS);
    return () => {
      window.removeEventListener(GAME_POINT_EVENT, handlePoint);
      window.clearInterval(timer);
      flush();
    };
  }, [code]);
};
