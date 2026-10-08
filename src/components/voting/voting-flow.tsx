"use client";

import { useState } from "react";
import type { BallotPosition } from "@/lib/view-models";
import { BallotStep } from "./ballot-step";
import { useGamePointsSync } from "./use-game-points-sync";
import { CodeStep } from "./code-step";
import { PhaseNotice } from "./phase-notice";
import { VoteSuccess } from "./vote-success";

type VotingFlowProps = {
  /** The code that opened this voting (from the QR link or the code form). */
  code: string;
  positions: BallotPosition[];
  alreadyVoted: boolean;
  gameOnly?: boolean;
};

type Step = { name: "ballot" } | { name: "code"; notice: string } | { name: "done" } | { name: "voted" };

export const VotingFlow = ({ code, positions, alreadyVoted, gameOnly }: VotingFlowProps) => {
  // ?c=… stays in the address bar on purpose: it is how this page knows which voting to show.
  const [step, setStep] = useState<Step>(() => (alreadyVoted ? { name: "voted" } : { name: "ballot" }));
  // Game points count for the projector's fun tally the whole time the voter is here, before and after voting.
  useGamePointsSync(code);

  const handleCast = () => setStep({ name: "done" });
  // The code was rotated or the voting closed while the ballot was open: ask for the current code.
  const handleRejected = (message: string) => setStep({ name: "code", notice: message });
  const handleAlreadyVoted = () => setStep({ name: "voted" });

  if (step.name === "done") return <VoteSuccess />;

  if (step.name === "voted") {
    return (
      <PhaseNotice
        heading="Ви вже проголосували"
        text="З цього пристрою голос уже враховано. Результати з'являться тут, коли адміністратор їх опублікує."
      />
    );
  }

  if (step.name === "code") {
    return (
      <div className="flex flex-col gap-4">
        <p className="error mx-auto" role="alert">
          {step.notice}
        </p>
        <CodeStep />
      </div>
    );
  }

  return (
    <BallotStep
      code={code}
      positions={positions}
      onCast={handleCast}
      onRejected={handleRejected}
      onAlreadyVoted={handleAlreadyVoted}
      gameOnly={gameOnly}
    />
  );
};
