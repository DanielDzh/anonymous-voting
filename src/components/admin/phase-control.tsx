"use client";

import { changePhase } from "@/app/actions/admin-actions";
import { PHASE_ACTION_LABELS, PHASE_LABELS, PHASE_ORDER, PHASE_TRANSITIONS } from "@/config/voting";
import type { Phase } from "@/lib/store/types";
import { useAdminAction } from "./use-admin-action";
import { useVotingId } from "./voting-context";

type PhaseButtonProps = {
  target: Phase;
  disabled: boolean;
  onPick: (target: Phase) => void;
};

const PhaseButton = ({ target, disabled, onPick }: PhaseButtonProps) => {
  const handleClick = () => onPick(target);
  const variant = target === "closed" ? "btn--glass" : "";
  return (
    <button type="button" className={`btn ${variant}`} disabled={disabled} onClick={handleClick}>
      {PHASE_ACTION_LABELS[target]}
    </button>
  );
};

type PhaseControlProps = { phase: Phase };

export const PhaseControl = ({ phase }: PhaseControlProps) => {
  const { error, isPending, run } = useAdminAction();
  const votingId = useVotingId();
  const currentIndex = PHASE_ORDER.indexOf(phase);

  const handlePick = (target: Phase) => run(() => changePhase(votingId, target));

  return (
    <section className="panel flex flex-col gap-6">
      <p className="tag">Фаза голосування</p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PHASE_ORDER.map((item, index) => (
          <li
            key={item}
            className={`rounded-xl border px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.15em] ${
              item === phase
                ? "border-white/60 bg-white/10 text-fg"
                : index < currentIndex
                  ? "border-line text-muted line-through"
                  : "border-line text-muted"
            }`}
          >
            {String(index + 1).padStart(2, "0")} · {PHASE_LABELS[item]}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        {PHASE_TRANSITIONS[phase].map((target) => (
          <PhaseButton key={target} target={target} disabled={isPending} onPick={handlePick} />
        ))}
      </div>
      {phase === "draft" && (
        <p className="text-sm text-muted">Після відкриття посади й кандидатів змінити вже не вийде.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
