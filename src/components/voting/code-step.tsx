"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { verifyCode } from "@/app/actions/vote-actions";
import { CODE_LENGTH, CODE_QUERY_PARAM } from "@/config/voting";
import { formatCode, isWellFormedCode, normalizeCode } from "@/lib/code-format";

/** Each voting has its own code: a valid one opens that voting (same page, code in the URL like the QR link). */
export const CodeStep = () => {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCode(normalizeCode(event.target.value).slice(0, CODE_LENGTH));
    setError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await verifyCode(code);
      if (result.ok) router.push(`/?${CODE_QUERY_PARAM}=${code}`);
      else setError(result.error);
    });
  };

  return (
    <div className="rise3d mx-auto max-w-xl">
      {/* No tilt here: a form shouldn't move under the cursor while someone aims for its button. */}
      <form className="panel flex flex-col gap-5" onSubmit={handleSubmit}>
        <label htmlFor="voting-code" className="tag">
          Введіть код голосування
        </label>
        <input
          id="voting-code"
          className="input code-input"
          value={formatCode(code)}
          onChange={handleChange}
          placeholder="XXX-XXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "voting-code-error" : undefined}
        />
        {error && (
          <p id="voting-code-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn" disabled={!isWellFormedCode(code) || isPending}>
          {isPending ? "Перевіряю…" : "Увійти до бюлетеня →"}
        </button>
        <p className="text-sm text-muted">
          Код вам дав організатор — або відскануйте QR. Голос анонімний: ніхто не знає, за кого ви голосували.
        </p>
      </form>
    </div>
  );
};
