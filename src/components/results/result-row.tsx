"use client";

import type { ResultCandidate } from "@/lib/view-models";
import { useCountUp } from "./use-count-up";

type ResultRowProps = {
  candidate: ResultCandidate;
  total: number;
  isLeader: boolean;
};

export const ResultRow = ({ candidate, total, isLeader }: ResultRowProps) => {
  const percent = total > 0 ? (candidate.votes / total) * 100 : 0;
  const shownPercent = useCountUp(percent);
  const shownVotes = useCountUp(candidate.votes);

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[color:var(--surface-border)] pt-3">
      <span className="flex items-center gap-3 font-semibold sm:text-lg">
        {candidate.name}
        {isLeader && <span className="tag !text-[color:var(--accent)]">Лідер</span>}
      </span>
      <span className="heading text-xl tabular-nums sm:text-2xl">
        {shownPercent.toFixed(1)}%
        <span className="ml-2 font-[family-name:var(--font-body)] text-xs font-medium text-muted">
          {Math.round(shownVotes)} гол.
        </span>
      </span>
    </li>
  );
};
