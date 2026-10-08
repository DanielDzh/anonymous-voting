"use client";

import { useEffect, useState, useTransition } from "react";
import { castBallot } from "@/app/actions/vote-actions";
import {
  CANDIDATE_SELECTED_EVENT,
  SELECT_CANDIDATE_REQUEST_EVENT,
} from "@/config/visuals";
import { formatCode } from "@/lib/code-format";
import type { BallotPosition } from "@/lib/view-models";
import { CandidateAvatar } from "@/components/ui/candidate-avatar";
import { CandidateOption } from "./candidate-option";

type BallotStepProps = {
  code: string;
  positions: BallotPosition[];
  onCast: () => void;
  onRejected: (message: string) => void;
  onAlreadyVoted: () => void;
  /** Game themes: the only way to choose is to hit a target, so the cards are replaced by "your pick". */
  gameOnly?: boolean;
};

const GamePick = ({
  candidate,
}: {
  candidate: BallotPosition["candidates"][number] | null;
}) => (
  <div className="panel flex items-center gap-4" aria-live="polite">
    {candidate ? (
      <>
        <CandidateAvatar name={candidate.name} photo={candidate.photo} />
        <div className="flex flex-col gap-1">
          <span className="tag">Ваш вибір</span>
          <span className="candidate__name">{candidate.name}</span>
        </div>
      </>
    ) : (
      <p className="text-muted">
        Ще нікого не обрано — влучте у свого кандидата в грі вище.
      </p>
    )}
  </div>
);

export const BallotStep = ({
  code,
  positions,
  onCast,
  onRejected,
  onAlreadyVoted,
  gameOnly = false,
}: BallotStepProps) => {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const chosenCount = positions.filter(
    (position) => choices[position.id],
  ).length;
  const isComplete = chosenCount === positions.length;

  const handleSelect = (positionId: string, candidateId: string) => {
    setChoices((current) => ({ ...current, [positionId]: candidateId }));
    setError(null);
  };

  // A game scene (e.g. the cannon) can choose a candidate too: a hit = the same as tapping the card.
  // It only selects; casting still needs the "Проголосувати" button.
  useEffect(() => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ candidateId?: string | null; among?: string[] }>).detail;
      const candidateId = detail?.candidateId;
      // A tie in a scoring game: nobody leads, so this position has no choice until someone does.
      if (candidateId === null) {
        const tied = positions.find((item) => item.candidates.some((candidate) => detail?.among?.includes(candidate.id)));
        if (!tied) return;
        setChoices((current) => {
          const next = { ...current };
          delete next[tied.id];
          return next;
        });
        window.dispatchEvent(new CustomEvent(CANDIDATE_SELECTED_EVENT, { detail: { photo: null, candidateId: null } }));
        return;
      }
      const position = positions.find((item) =>
        item.candidates.some((candidate) => candidate.id === candidateId),
      );
      const candidate = position?.candidates.find(
        (item) => item.id === candidateId,
      );
      if (!position || !candidate) return;
      setChoices((current) => ({ ...current, [position.id]: candidate.id }));
      setError(null);
      window.dispatchEvent(
        new CustomEvent(CANDIDATE_SELECTED_EVENT, {
          detail: { photo: candidate.photo, candidateId: candidate.id },
        }),
      );
    };
    window.addEventListener(SELECT_CANDIDATE_REQUEST_EVENT, handleRequest);
    return () =>
      window.removeEventListener(SELECT_CANDIDATE_REQUEST_EVENT, handleRequest);
  }, [positions]);

  const handleSubmit = () => {
    const selections = Object.entries(choices).map(
      ([positionId, candidateId]) => ({ positionId, candidateId }),
    );
    startTransition(async () => {
      const result = await castBallot(code, selections);
      if (result.ok) onCast();
      else if (result.kind === "ballot") setError(result.error);
      else if (result.kind === "voted") onAlreadyVoted();
      else onRejected(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-12">
      <p className="tag">
        Код {formatCode(code)} прийнято ·{" "}
        {gameOnly
          ? "влучте гарматою у свого кандидата"
          : "оберіть по одному кандидату на кожну посаду"}
      </p>

      {positions.map((position, positionIndex) => (
        <section key={position.id} className="flex flex-col gap-5">
          <div className="flex items-baseline gap-4">
            <span className="tag">
              {String(positionIndex + 1).padStart(2, "0")}
            </span>
            <h2 className="heading text-2xl sm:text-4xl">{position.title}</h2>
          </div>
          {gameOnly ? (
            <GamePick
              candidate={
                position.candidates.find(
                  (candidate) => candidate.id === choices[position.id],
                ) ?? null
              }
            />
          ) : (
            <div
              role="radiogroup"
              aria-label={position.title}
              className="grid gap-5 md:grid-cols-2"
            >
              {position.candidates.map((candidate, candidateIndex) => (
                <CandidateOption
                  key={candidate.id}
                  candidate={candidate}
                  positionId={position.id}
                  index={candidateIndex + positionIndex}
                  selected={choices[position.id] === candidate.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      <div className="panel rise3d flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            Обрано <b>{chosenCount}</b> з {positions.length}
          </p>
          <p className="text-sm text-muted">
            Після надсилання змінити голос неможливо.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn"
          disabled={!isComplete || isPending}
          onClick={handleSubmit}
        >
          {isPending ? "Надсилаю…" : "Проголосувати"}
        </button>
      </div>
    </div>
  );
};
