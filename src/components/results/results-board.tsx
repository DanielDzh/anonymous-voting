"use client";

import { STAGGER_MS } from "@/config/visuals";
import type { ResultPosition } from "@/lib/view-models";
import { Columns3D } from "./columns-3d";
import { ResultRow } from "./result-row";

type ResultsBoardProps = {
  positions: ResultPosition[];
};

const leaderIdsOf = (position: ResultPosition): Set<string> => {
  const top = Math.max(0, ...position.candidates.map((candidate) => candidate.votes));
  // No leader until someone has a vote; ties highlight everyone on top.
  return new Set(top === 0 ? [] : position.candidates.filter((c) => c.votes === top).map((c) => c.id));
};

export const ResultsBoard = ({ positions }: ResultsBoardProps) => (
  <div className="flex flex-col gap-6">
    {positions.map((position, index) => {
      const total = position.candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
      const leaders = leaderIdsOf(position);
      const sorted = [...position.candidates].sort((a, b) => b.votes - a.votes);

      return (
        <section key={position.id} className="panel rise3d flex flex-col gap-4" style={{ animationDelay: `${index * STAGGER_MS}ms` }}>
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="heading text-xl sm:text-3xl">{position.title}</h2>
            <span className="tag">Голосів: {total}</span>
          </header>
          <Columns3D candidates={position.candidates} total={total} leaders={leaders} />
          <ol className="flex flex-col gap-3">
            {sorted.map((candidate) => (
              <ResultRow key={candidate.id} candidate={candidate} total={total} isLeader={leaders.has(candidate.id)} />
            ))}
          </ol>
        </section>
      );
    })}
  </div>
);
