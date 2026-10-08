"use client";

import { changeTheme } from "@/app/actions/admin-actions";
import { THEMES } from "@/themes/registry";
import type { ThemeId, ThemeMeta } from "@/themes/types";
import { useAdminAction } from "./use-admin-action";
import { useVotingId } from "./voting-context";

type ThemeCardProps = {
  theme: ThemeMeta;
  active: boolean;
  busy: boolean;
  onPick: (id: ThemeId) => void;
};

const ThemeCard = ({ theme, active, busy, onPick }: ThemeCardProps) => {
  const handleClick = () => onPick(theme.id);
  const isSoon = theme.status === "soon";
  const [base, accent] = theme.swatch;

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={busy || isSoon || active}
      onClick={handleClick}
      className={`group flex flex-col gap-3 rounded-xl border p-3 text-left transition ${
        active ? "border-[color:var(--accent)] bg-white/[0.06]" : "border-[color:var(--surface-border)] hover:bg-white/[0.04]"
      } ${isSoon ? "cursor-not-allowed opacity-45" : ""}`}
    >
      <span className="relative block h-16 overflow-hidden rounded-lg" style={{ background: base }} aria-hidden="true">
        <span
          className="absolute -right-3 -bottom-3 h-12 w-12 rounded-full transition-transform duration-500 group-hover:scale-125"
          style={{ background: accent }}
        />
        <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {theme.number}
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">
          {theme.label}
          {active && <span className="ml-2 text-[color:var(--accent)]">● активна</span>}
        </span>
        <span className="text-xs text-muted">{isSoon ? "Скоро" : theme.description}</span>
      </span>
    </button>
  );
};

type ThemePickerProps = { current: ThemeId };

export const ThemePicker = ({ current }: ThemePickerProps) => {
  const { error, isPending, run } = useAdminAction();
  const votingId = useVotingId();
  const handlePick = (id: ThemeId) => run(() => changeTheme(votingId, id));

  return (
    <section className="panel flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="tag">Тема для виборців</p>
        <a href="/" target="_blank" rel="noreferrer" className="text-sm text-[color:var(--accent)] hover:underline">
          Відкрити сторінку виборця ↗
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {THEMES.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} active={theme.id === current} busy={isPending} onPick={handlePick} />
        ))}
      </div>
      <p className="text-sm text-muted">Тему можна змінити будь-коли: на голоси це не впливає. Виборці побачать її після оновлення сторінки.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
