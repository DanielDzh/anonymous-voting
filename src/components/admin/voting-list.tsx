"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createVoting, logout } from "@/app/actions/admin-actions";
import { MAX_TITLE_LENGTH, PHASE_LABELS } from "@/config/voting";
import { formatCode } from "@/lib/code-format";
import type { AdminVotingRow } from "@/lib/view-models";
import { THEMES } from "@/themes/registry";
import { useAdminAction } from "./use-admin-action";
import { useLiveRefresh } from "./use-live-refresh";

const DATE_FORMAT = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });

const themeLabel = (id: string) => THEMES.find((theme) => theme.id === id)?.label ?? id;

const ballotsLabel = (count: number) => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} голосів`;
  if (last === 1) return `${count} голос`;
  if (last >= 2 && last <= 4) return `${count} голоси`;
  return `${count} голосів`;
};

const NewVotingForm = () => {
  const { error, isPending, run } = useAdminAction();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // On success the action redirects straight into the new voting.
    run(() => createVoting(formData));
  };

  if (!isOpen) {
    return (
      <button type="button" className="btn" onClick={handleOpen}>
        + Нове голосування
      </button>
    );
  }

  return (
    <form className="panel flex flex-col gap-4" onSubmit={handleSubmit}>
      <label htmlFor="new-voting-title" className="tag">
        Назва нового голосування
      </label>
      <input
        id="new-voting-title"
        name="title"
        className="input"
        maxLength={MAX_TITLE_LENGTH}
        placeholder="Напр. «Староста групи»"
        autoFocus
        required
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn" disabled={isPending}>
          {isPending ? "Створюю…" : "Створити"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={isPending}>
          Скасувати
        </button>
      </div>
    </form>
  );
};

type VotingListProps = { votings: AdminVotingRow[] };

/** The admin's home: every voting with its state; a row opens that voting's dashboard. */
export const VotingList = ({ votings }: VotingListProps) => {
  // Vote counters on the list stay live too.
  useLiveRefresh();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="tag">Панель адміністратора</p>
          <form action={logout}>
            <button type="submit" className="btn btn--ghost btn--small">
              Вийти
            </button>
          </form>
        </div>
        <h1 className="display text-[clamp(32px,7vw,88px)]">Мої голосування</h1>
      </header>

      <NewVotingForm />

      {votings.length === 0 ? (
        <p className="panel text-muted">Поки жодного голосування. Створіть перше — кнопкою вище.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {votings.map((voting) => (
            <li key={voting.id}>
              <Link href={`/admin/v/${voting.id}`} className="panel voting-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-xl font-semibold">{voting.title}</span>
                  <span className="text-sm text-muted">
                    код {formatCode(voting.accessCode)} · тема {themeLabel(voting.theme)} · створено{" "}
                    {DATE_FORMAT.format(new Date(voting.createdAt))}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className={`phase-badge phase-badge--${voting.phase}`}>{PHASE_LABELS[voting.phase]}</span>
                  <span className="text-sm tabular-nums">{ballotsLabel(voting.ballotsCast)}</span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
