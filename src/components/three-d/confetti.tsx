"use client";

import { useState, type CSSProperties } from "react";

const PIECES = 80;
const COLOR_VARS = ["--confetti-1", "--confetti-2", "--confetti-3", "--confetti-4"];

type Piece = { id: number; style: CSSProperties };

const random = (min: number, max: number) => min + Math.random() * (max - min);

const createPieces = (): Piece[] =>
  Array.from({ length: PIECES }, (_, id) => ({
    id,
    style: {
      left: `${random(0, 100)}%`,
      background: `var(${COLOR_VARS[id % COLOR_VARS.length]})`,
      "--dx": `${random(-160, 160)}px`,
      "--dz": `${random(-300, 300)}px`,
      "--ax": random(-1, 1).toFixed(2),
      "--ay": random(-1, 1).toFixed(2),
      "--spin": `${random(540, 1440)}deg`,
      "--dur": `${random(2.4, 4.2)}s`,
      "--delay": `${random(0, 0.6)}s`,
    } as CSSProperties,
  }));

/** One-shot burst of pieces tumbling in 3D, coloured by the active theme. */
export const Confetti = () => {
  // Only ever mounted after a vote on the client (never server-rendered), so random layout can't mismatch.
  const [pieces] = useState<Piece[]>(createPieces);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span key={piece.id} className="confetti__piece" style={piece.style} />
      ))}
    </div>
  );
};
