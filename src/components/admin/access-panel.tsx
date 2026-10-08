"use client";

import { useState } from "react";
import { regenerateAccessCode } from "@/app/actions/admin-actions";
import { formatCode } from "@/lib/code-format";
import { useAdminAction } from "./use-admin-action";
import { useVotingId } from "./voting-context";

const COPY_FEEDBACK_MS = 1600;
const PNG_SIZE_PX = 1024;

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/** Rasterises the QR SVG to a crisp PNG (handy for slides and messengers). */
const svgToPngBlob = (svg: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE_PX;
      canvas.height = PNG_SIZE_PX;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("canvas unavailable"));
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, PNG_SIZE_PX, PNG_SIZE_PX);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png export failed"))), "image/png");
    };
    image.onerror = () => reject(new Error("svg load failed"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

type AccessPanelProps = {
  accessCode: string;
  joinUrl: string;
  qrSvg: string;
};

export const AccessPanel = ({ accessCode, joinUrl, qrSvg }: AccessPanelProps) => {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { error, isPending, run } = useAdminAction();
  const votingId = useVotingId();
  const fileBase = `qr-${accessCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };
  const handleSvg = () => saveBlob(new Blob([qrSvg], { type: "image/svg+xml" }), `${fileBase}.svg`);
  const handlePng = async () => saveBlob(await svgToPngBlob(qrSvg), `${fileBase}.png`);
  const handleAskRegenerate = () => setConfirming(true);
  const handleCancelRegenerate = () => setConfirming(false);
  const handleRegenerate = () => run(() => regenerateAccessCode(votingId), () => setConfirming(false));

  return (
    <section className="panel flex flex-col gap-6">
      <p className="tag">Код і QR для входу</p>
      <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
        {/* SVG comes from our own qrcode render on the server, not from user input. */}
        <div
          className="aspect-square w-full max-w-[220px] overflow-hidden rounded-xl bg-white p-1 [&_svg]:h-full [&_svg]:w-full"
          role="img"
          aria-label={`QR-код: ${joinUrl}`}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted">Код голосування</p>
            <p className="font-mono text-5xl font-semibold tracking-[0.18em]">{formatCode(accessCode)}</p>
          </div>
          <p className="text-sm break-all text-muted">{joinUrl}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/v/${votingId}/present`} target="_blank" rel="noreferrer" className="btn btn--small">
              Показати на екрані ↗
            </a>
            <button type="button" className="btn btn--ghost btn--small" onClick={handleCopy}>
              {copied ? "Скопійовано ✓" : "Копіювати посилання"}
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={handlePng}>
              PNG
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={handleSvg}>
              SVG
            </button>
          </div>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Старий код і всі QR з ним перестануть працювати.</span>
              <button type="button" className="btn btn--danger btn--small" disabled={isPending} onClick={handleRegenerate}>
                Так, новий код
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={handleCancelRegenerate}>
                Скасувати
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--danger btn--small self-start" onClick={handleAskRegenerate}>
              Згенерувати новий код
            </button>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">
        Один спільний код для всіх. Повторний голос з того самого браузера сервер не прийме, але інкогніто чи інший
        пристрій це обходять — роздавайте код лише тим, хто має голосувати.
      </p>
    </section>
  );
};
