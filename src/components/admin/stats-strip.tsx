"use client";

import { useCountUp } from "@/components/results/use-count-up";
import { PHASE_LABELS } from "@/config/voting";
import type { Phase } from "@/lib/store/types";

type StatsStripProps = { ballotsCast: number; phase: Phase };

export const StatsStrip = ({ ballotsCast, phase }: StatsStripProps) => {
  const shown = useCountUp(ballotsCast);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="panel flex flex-col gap-2">
        <span className="tag">Проголосувало</span>
        <span className="text-4xl font-extrabold tracking-tight tabular-nums text-[color:var(--accent)] sm:text-5xl">
          {Math.round(shown)}
        </span>
      </div>
      <div className="panel flex flex-col gap-2">
        <span className="tag">Фаза</span>
        <span className="text-4xl font-extrabold tracking-tight sm:text-5xl">{PHASE_LABELS[phase]}</span>
      </div>
    </div>
  );
};
