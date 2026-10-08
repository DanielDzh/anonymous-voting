"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useTilt } from "@/components/three-d/use-tilt";
import { CandidateAvatar } from "@/components/ui/candidate-avatar";
import type { ResultCandidate } from "@/lib/view-models";

type Columns3DProps = {
  candidates: ResultCandidate[];
  total: number;
  leaders: Set<string>;
};

const FACES = ["front", "back", "left", "right", "top"] as const;

type ColumnProps = { candidate: ResultCandidate; percent: number; heightPercent: number; isLeader: boolean };

const Column = ({ candidate, percent, heightPercent, isLeader }: ColumnProps) => {
  // Grow from zero after mount so the height transition plays.
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHeight(heightPercent));
    return () => cancelAnimationFrame(frame);
  }, [heightPercent]);

  const style = { "--h": `${height}%`, "--col": isLeader ? "var(--bar-lead)" : "var(--bar-fill)" } as CSSProperties;

  return (
    <div className="flex h-full flex-col items-center justify-end gap-4">
      {/* flex-1 gives the track a definite height, so the column's % height resolves. */}
      <div className="flex w-full flex-1 items-end justify-center">
        <div className="column" style={style} role="img" aria-label={`${candidate.name}: ${percent.toFixed(1)}%`}>
          {FACES.map((face) => (
            <span key={face} className={`column__face column__${face}`} />
          ))}
        </div>
      </div>
      <CandidateAvatar name={candidate.name} photo={candidate.photo} size="small" />
    </div>
  );
};

/** A small 3D bar chart that leans toward the pointer. */
export const Columns3D = ({ candidates, total, leaders }: Columns3DProps) => {
  const tiltRef = useTilt<HTMLDivElement>(12);
  // Heights are relative to the leader so the chart always uses its full height; labels still show share of total.
  const maxVotes = Math.max(0, ...candidates.map((candidate) => candidate.votes));

  return (
    <div ref={tiltRef} className="tilt columns">
      {candidates.map((candidate) => (
        <Column
          key={candidate.id}
          candidate={candidate}
          percent={total > 0 ? (candidate.votes / total) * 100 : 0}
          heightPercent={maxVotes > 0 ? (candidate.votes / maxVotes) * 100 : 0}
          isLeader={leaders.has(candidate.id)}
        />
      ))}
    </div>
  );
};
