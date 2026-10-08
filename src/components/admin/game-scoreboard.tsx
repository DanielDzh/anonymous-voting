"use client";

import { useEffect, useRef } from "react";
import { useCountUp } from "@/components/results/use-count-up";
import { CandidateAvatar } from "@/components/ui/candidate-avatar";
import type { AdminSnapshot } from "@/lib/view-models";

type Entry = AdminSnapshot["gamePoints"][number];

const pointsFormat = new Intl.NumberFormat("uk-UA");
/** "+N" floats up and fades when a candidate's points grow. */
const BUMP_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(6px) scale(0.8)" },
  { opacity: 1, transform: "translateY(-4px) scale(1.1)", offset: 0.25 },
  { opacity: 0, transform: "translateY(-22px) scale(1)" },
];
const BUMP_MS = 1400;

const ScoreRow = ({ entry, best, isLeader }: { entry: Entry; best: number; isLeader: boolean }) => {
  const shown = useCountUp(entry.points);
  const previous = useRef(entry.points);
  const bumpRef = useRef<HTMLSpanElement>(null);

  // On growth, flash "+N" next to the number (Web Animations: no global CSS needed).
  useEffect(() => {
    const gained = entry.points - previous.current;
    previous.current = entry.points;
    const bump = bumpRef.current;
    if (gained <= 0 || !bump) return;
    bump.textContent = `+${pointsFormat.format(gained)}`;
    bump.animate(BUMP_KEYFRAMES, { duration: BUMP_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }, [entry.points]);

  const share = best > 0 ? entry.points / best : 0;

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <CandidateAvatar name={entry.name} photo={entry.photo} size="small" />
        <span className={`min-w-0 flex-1 truncate text-2xl ${isLeader ? "font-semibold" : ""}`}>{entry.name}</span>
        <span className="relative">
          <span ref={bumpRef} className="pointer-events-none absolute top-1/2 right-full mr-3 -translate-y-1/2 text-xl font-semibold whitespace-nowrap text-[color:var(--accent)] opacity-0" aria-hidden="true" />
          <span className={`text-4xl tabular-nums ${isLeader ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]"}`}>
            {pointsFormat.format(Math.round(shown))}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-border)]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${isLeader ? "bg-[color:var(--accent)]" : "bg-[color:var(--muted)]"}`}
          style={{ width: `${Math.max(share * 100, entry.points > 0 ? 2 : 0)}%` }}
        />
      </div>
    </li>
  );
};

/**
 * Room-wide game tally on the projector — every basket, pin and dart point scored for each
 * candidate by everyone. Clearly labelled as fun, so nobody reads it as the result.
 */
export const GameScoreboard = ({ entries }: { entries: AdminSnapshot["gamePoints"] }) => {
  const best = Math.max(0, ...entries.map((entry) => entry.points));
  // Only a sole leader is highlighted; a tie highlights nobody, like the games.
  const leaders = entries.filter((entry) => entry.points === best).length;
  const total = entries.reduce((sum, entry) => sum + entry.points, 0);
  const shownTotal = useCountUp(total);

  return (
    <section className="panel flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="tag">Влучання в грі · по фану, не голоси</p>
        <p className="text-sm text-[color:var(--muted)] tabular-nums">разом {pointsFormat.format(Math.round(shownTotal))}</p>
      </div>
      <ul className="flex flex-col gap-5">
        {entries.map((entry) => (
          <ScoreRow key={entry.id} entry={entry} best={best} isLeader={best > 0 && leaders === 1 && entry.points === best} />
        ))}
      </ul>
    </section>
  );
};
