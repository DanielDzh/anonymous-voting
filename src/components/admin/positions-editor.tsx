"use client";

import type { FormEvent } from "react";
import { createCandidate, createPosition, deleteCandidate, deletePosition } from "@/app/actions/admin-actions";
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, MAX_TITLE_LENGTH } from "@/config/voting";
import type { ResultCandidate, ResultPosition } from "@/lib/view-models";
import { CandidatePhotoControl } from "./candidate-photo-control";
import { useAdminAction } from "./use-admin-action";
import { useVotingId } from "./voting-context";

type RunAction = ReturnType<typeof useAdminAction>["run"];

type CandidateItemProps = {
  candidate: ResultCandidate;
  editable: boolean;
  busy: boolean;
  run: RunAction;
};

const CandidateItem = ({ candidate, editable, busy, run }: CandidateItemProps) => {
  const votingId = useVotingId();
  const handleDelete = () => run(() => deleteCandidate(votingId, candidate.id));
  return (
    <li className="flex flex-col gap-3 border-l-2 border-white/20 py-1 pl-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-bold">{candidate.name}</span>
          {candidate.description && <span className="text-sm text-muted">{candidate.description}</span>}
        </div>
        {editable && (
          <button type="button" className="btn btn--danger btn--small shrink-0" disabled={busy} onClick={handleDelete}>
            Видалити
          </button>
        )}
      </div>
      <CandidatePhotoControl candidate={candidate} busy={busy} run={run} />
    </li>
  );
};

type PositionCardProps = {
  position: ResultPosition;
  editable: boolean;
  busy: boolean;
  run: RunAction;
};

const PositionCard = ({ position, editable, busy, run }: PositionCardProps) => {
  const votingId = useVotingId();
  const handleDeletePosition = () => run(() => deletePosition(votingId, position.id));

  const handleAddCandidate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    run(
      () => createCandidate(votingId, formData),
      () => form.reset(),
    );
  };

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-line bg-black/25 p-5">
      <header className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-extrabold tracking-tight">{position.title}</h3>
        {editable && (
          <button type="button" className="btn btn--danger btn--small shrink-0" disabled={busy} onClick={handleDeletePosition}>
            Видалити посаду
          </button>
        )}
      </header>

      {position.candidates.length === 0 ? (
        <p className="text-sm text-muted">Кандидатів ще немає.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {position.candidates.map((candidate) => (
            <CandidateItem key={candidate.id} candidate={candidate} editable={editable} busy={busy} run={run} />
          ))}
        </ul>
      )}

      {editable && (
        <form onSubmit={handleAddCandidate} className="flex flex-col gap-3">
          <input type="hidden" name="positionId" value={position.id} />
          <input name="name" required maxLength={MAX_NAME_LENGTH} placeholder="Ім'я кандидата" className="input" />
          <textarea name="description" maxLength={MAX_DESCRIPTION_LENGTH} placeholder="Короткий опис (необов'язково)" className="input" />
          <button type="submit" className="btn btn--small self-start" disabled={busy}>
            + Додати кандидата
          </button>
        </form>
      )}
    </article>
  );
};

type PositionsEditorProps = {
  positions: ResultPosition[];
  editable: boolean;
};

export const PositionsEditor = ({ positions, editable }: PositionsEditorProps) => {
  const { error, isPending, run } = useAdminAction();
  const votingId = useVotingId();

  const handleAddPosition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    run(
      () => createPosition(votingId, formData),
      () => form.reset(),
    );
  };

  return (
    <section className="panel flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tag">Посади та кандидати</p>
        {!editable && (
          <span className="text-xs text-muted">Склад заблоковано: голосування стартувало. Фото змінювати можна.</span>
        )}
      </div>

      <p className="text-xs text-muted">
        Фото показуються на картках кандидатів у всіх темах, а в смішних — ще й у 3D-сцені. Завантажуйте фото тільки за згодою людини.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {positions.map((position) => (
          <PositionCard key={position.id} position={position} editable={editable} busy={isPending} run={run} />
        ))}
      </div>

      {editable && (
        <form onSubmit={handleAddPosition} className="flex flex-col gap-3 sm:flex-row">
          <input name="title" required maxLength={MAX_TITLE_LENGTH} placeholder="Нова посада" className="input" />
          <button type="submit" className="btn btn--glass shrink-0" disabled={isPending}>
            + Посада
          </button>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
