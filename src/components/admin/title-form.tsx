"use client";

import type { FormEvent } from "react";
import { updateTitle } from "@/app/actions/admin-actions";
import { MAX_TITLE_LENGTH } from "@/config/voting";
import { useAdminAction } from "./use-admin-action";
import { useVotingId } from "./voting-context";

type TitleFormProps = { title: string };

export const TitleForm = ({ title }: TitleFormProps) => {
  const { error, isPending, run } = useAdminAction();
  const votingId = useVotingId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => updateTitle(votingId, formData));
  };

  return (
    <form onSubmit={handleSubmit} className="panel flex flex-col gap-4">
      <label htmlFor="voting-title" className="tag">
        Назва голосування
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="voting-title"
          name="title"
          defaultValue={title}
          maxLength={MAX_TITLE_LENGTH}
          required
          className="input"
        />
        <button type="submit" className="btn btn--glass shrink-0" disabled={isPending}>
          Зберегти
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};
