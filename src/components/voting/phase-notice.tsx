"use client";

import { useTilt } from "@/components/three-d/use-tilt";

type PhaseNoticeProps = {
  heading: string;
  text: string;
};

export const PhaseNotice = ({ heading, text }: PhaseNoticeProps) => {
  const tiltRef = useTilt<HTMLDivElement>(6);

  return (
    <div className="rise3d mx-auto max-w-xl">
      <div ref={tiltRef} className="panel tilt flex flex-col gap-4">
        <p className="flex items-center gap-3">
          <span className="pulse-dot" aria-hidden="true" />
          <span className="tag">Статус</span>
        </p>
        <h2 className="heading text-3xl">{heading}</h2>
        <p className="text-muted">{text}</p>
      </div>
    </div>
  );
};
