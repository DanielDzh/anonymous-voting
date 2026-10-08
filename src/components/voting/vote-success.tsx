"use client";

import { Confetti } from "@/components/three-d/confetti";
import { useTilt } from "@/components/three-d/use-tilt";

export const VoteSuccess = () => {
  const tiltRef = useTilt<HTMLDivElement>(8);

  return (
    <>
      <Confetti />
      <div className="rise3d mx-auto max-w-xl">
        <div ref={tiltRef} className="panel tilt flex flex-col items-center gap-6 py-12 text-center">
          <span className="monogram monogram--large" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h2 className="display text-4xl sm:text-5xl">Голос зараховано</h2>
          <p className="max-w-sm text-muted">
            Дякуємо! Ваш код погашено. Результати з&apos;являться тут, коли адміністратор їх опублікує.
          </p>
        </div>
      </div>
    </>
  );
};
