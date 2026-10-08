"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PRESENT_LIVE_REFRESH_MS } from "@/config/voting";
import type { LiveStats } from "@/lib/store/types";

/**
 * Polls the projector's tiny live endpoint. Counters update in place; only when something that
 * changes the page itself moves (title, theme, phase, or a new code → new QR) does it re-render.
 */
export const useLiveStats = (votingId: string, initial: LiveStats): LiveStats => {
  const router = useRouter();
  const [stats, setStats] = useState(initial);
  // What the page was rendered with; a change in any of these needs a fresh page.
  const { title, theme, phase, accessCode } = initial;

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/admin/v/${votingId}/live`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const next = (await response.json()) as LiveStats;
        setStats(next);
        if (next.title !== title || next.theme !== theme || next.phase !== phase || next.accessCode !== accessCode) router.refresh();
      } catch {
        // A missed poll is fine: the next one catches up.
      }
    };
    const timer = window.setInterval(poll, PRESENT_LIVE_REFRESH_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [votingId, title, theme, phase, accessCode, router]);

  return stats;
};
