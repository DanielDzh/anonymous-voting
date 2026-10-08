"use client";

import { useState } from "react";
import { deleteVoting } from "@/app/actions/admin-actions";
import { useAdminAction } from "./use-admin-action";
import { useVotingId } from "./voting-context";

/** Permanent removal with a single "are you sure?" step; on success the action returns to the list. */
export const DeleteVoting = ({ title }: { title: string }) => {
  const { error, isPending, run } = useAdminAction();
  const votingId = useVotingId();
  const [confirming, setConfirming] = useState(false);

  const handleAsk = () => setConfirming(true);
  const handleCancel = () => setConfirming(false);
  const handleDelete = () => run(() => deleteVoting(votingId));

  return (
    <section className="panel flex flex-col gap-4">
      <p className="tag">Небезпечна зона</p>
      {confirming ? (
        <>
          <p>
            Ви впевнені? Голосування «{title}» буде видалено назавжди — разом із кандидатами, фото й голосами. Його код
            перестане працювати.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Видаляю…" : "Так, видалити"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleCancel} disabled={isPending}>
              Скасувати
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn--danger self-start" onClick={handleAsk}>
          Видалити голосування
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
