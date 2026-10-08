"use client";

import { useId, useState, type ChangeEvent } from "react";
import { setCandidatePhoto } from "@/app/actions/admin-actions";
import { fileToSquareJpeg } from "@/lib/image-resize";
import type { ResultCandidate } from "@/lib/view-models";
import type { useAdminAction } from "./use-admin-action";
import { useVotingId } from "./voting-context";

const UNREADABLE_PHOTO = "Не вдалося прочитати фото. Спробуйте JPG або PNG (HEIC з iPhone підтримує лише Safari).";

type CandidatePhotoControlProps = {
  candidate: ResultCandidate;
  busy: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
};

/**
 * Thumbnail + upload/remove. The picker is a native <label> over a visually hidden input
 * (no JS .click(), which some mobile browsers ignore). Compression happens here, in the browser.
 */
export const CandidatePhotoControl = ({ candidate, busy, run }: CandidatePhotoControlProps) => {
  const inputId = useId();
  const votingId = useVotingId();
  const [readError, setReadError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setReadError(null);
    setCompressing(true);
    try {
      const photo = await fileToSquareJpeg(file);
      run(() => setCandidatePhoto(votingId, candidate.id, photo));
    } catch {
      setReadError(UNREADABLE_PHOTO);
    } finally {
      setCompressing(false);
    }
  };

  const handleRemove = () => run(() => setCandidatePhoto(votingId, candidate.id, null));
  const disabled = busy || compressing;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {candidate.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing for next/image to optimise
          <img src={candidate.photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-dashed border-white/25 text-[10px] text-muted">
            фото
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={handleFile}
        />
        <label
          htmlFor={inputId}
          className={`btn btn--ghost btn--small ${disabled ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
        >
          {compressing ? "Стискаю…" : candidate.photo ? "Замінити" : "Додати фото"}
        </label>
        {candidate.photo && (
          <button type="button" className="btn btn--danger btn--small" disabled={disabled} onClick={handleRemove}>
            Прибрати
          </button>
        )}
      </div>
      {readError && (
        <p className="error text-xs" role="alert">
          {readError}
        </p>
      )}
    </div>
  );
};
