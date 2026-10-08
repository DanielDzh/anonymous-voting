"use client";

import { useTilt } from "@/components/three-d/use-tilt";
import { CandidateAvatar } from "@/components/ui/candidate-avatar";
import { CANDIDATE_SELECTED_EVENT, STAGGER_MS } from "@/config/visuals";
import type { BallotCandidate } from "@/lib/view-models";

type CandidateOptionProps = {
  candidate: BallotCandidate;
  positionId: string;
  index: number;
  selected: boolean;
  onSelect: (positionId: string, candidateId: string) => void;
};

/** Flip card: tilts toward the pointer, turns over to its confirmation side once chosen. */
export const CandidateOption = ({ candidate, positionId, index, selected, onSelect }: CandidateOptionProps) => {
  const tiltRef = useTilt<HTMLButtonElement>();
  const handleClick = () => {
    onSelect(positionId, candidate.id);
    // Lets photo-theme scenes react (e.g. the matching bobblehead jumps for joy).
    window.dispatchEvent(
      new CustomEvent(CANDIDATE_SELECTED_EVENT, { detail: { photo: candidate.photo, candidateId: candidate.id } }),
    );
  };

  return (
    <div className="rise3d" style={{ animationDelay: `${index * STAGGER_MS}ms` }}>
      <button
        ref={tiltRef}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={candidate.name}
        className="candidate tilt"
        onClick={handleClick}
      >
        <span className="candidate__inner">
          <span className="candidate__face candidate__front">
            <CandidateAvatar name={candidate.name} photo={candidate.photo} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="candidate__name">{candidate.name}</span>
              {candidate.description && <span className="text-sm text-muted">{candidate.description}</span>}
            </span>
          </span>
          <span className="candidate__face candidate__back" aria-hidden="true">
            <span className="candidate__check">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="tag !text-current opacity-80">Ваш вибір</span>
              <span className="candidate__name">{candidate.name}</span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
};
