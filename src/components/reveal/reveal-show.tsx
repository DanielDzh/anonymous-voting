"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCountUp } from "@/components/results/use-count-up";
import type { AdminSnapshot } from "@/lib/view-models";
import { createRevealMusic, type RevealMusic } from "./reveal-music";
import { REVEAL_MAX_HEIGHT, REVEAL_RACE, createRevealStage, type LabelAnchor, type RevealController } from "./reveal-scene";

/** Text slides/fades in whenever its key changes (Web Animations: no global CSS needed). */
const ENTER: Keyframe[] = [
  { opacity: 0, transform: "translateY(18px)", filter: "blur(6px)" },
  { opacity: 1, transform: "none", filter: "blur(0)" },
];
const POP: Keyframe[] = [
  { opacity: 0, transform: "scale(0.6)", letterSpacing: "0.3em" },
  { opacity: 1, transform: "scale(1.06)", offset: 0.6 },
  { opacity: 1, transform: "scale(1)", letterSpacing: "normal" },
];
const useEnter = <T extends HTMLElement>(key: string, keyframes: Keyframe[] = ENTER, duration = 700) => {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.animate(keyframes, { duration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "both" });
  }, [key, keyframes, duration]);
  return ref;
};

/**
 * Projector results show. The admin is the host: Space / → / Enter / PageDown / click = next step,
 * ← / PageUp = back, F = fullscreen. Per position: the candidates on the start line, then one
 * press starts the race — everyone climbs slowly together, each stops at their result (their
 * numbers appear), the leader breaks away and wins. It never changes the voting's phase.
 */

type Step = { kind: "intro" } | { kind: "ready"; position: number } | { kind: "race"; position: number };

const NEXT_KEYS = new Set([" ", "ArrowRight", "Enter", "PageDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "PageUp", "Backspace"]);
const MIN_HEIGHT_SHARE = 0.06;
const percentFormat = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 });

const votesLabel = (count: number) => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} голосів`;
  if (last === 1) return `${count} голос`;
  if (last >= 2 && last <= 4) return `${count} голоси`;
  return `${count} голосів`;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Final heights (relative to the leader) and the winner(s) of a position. */
const raceOf = (votes: number[]) => {
  const best = Math.max(...votes, 0);
  return {
    heights: votes.map((count) => (best > 0 ? Math.max(count / best, MIN_HEIGHT_SHARE) : MIN_HEIGHT_SHARE) * REVEAL_MAX_HEIGHT),
    winners: votes.flatMap((count, index) => (count === best ? [index] : [])),
  };
};

const Scoreline = ({ votes, total, visible }: { votes: number; total: number; visible: boolean }) => {
  const shown = useCountUp(visible ? votes : 0);
  if (!visible) return <span className="text-[clamp(22px,4.4vh,56px)] font-semibold text-white/50 [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]">?</span>;
  return (
    <span className="inline-flex flex-col items-center rounded-2xl bg-black/55 px-[2vh] py-[0.6vh] backdrop-blur-sm">
      <span className="text-[clamp(22px,4.4vh,56px)] leading-tight font-semibold tabular-nums">{percentFormat.format(total > 0 ? (shown / total) * 100 : 0)}%</span>
      <span className="text-[clamp(11px,1.7vh,20px)] text-white/75 tabular-nums">{votesLabel(Math.round(shown))}</span>
    </span>
  );
};

export const RevealShow = ({ snapshot }: { snapshot: AdminSnapshot }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<RevealController | null>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const positions = useMemo(() => snapshot.results.filter((item) => item.candidates.length > 0), [snapshot.results]);
  const steps: Step[] = useMemo(
    () => [{ kind: "intro" }, ...positions.flatMap((_, position): Step[] => [{ kind: "ready", position }, { kind: "race", position }])],
    [positions],
  );
  // Which pedestals have stopped (their numbers show) and whether the winner has landed.
  const [stopped, setStopped] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);
  const musicRef = useRef<RevealMusic | null>(null);
  const [muted, setMuted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const position = step.kind === "intro" ? null : positions[step.position];
  // The intro already shows the first position's pedestals (hidden), so the stage is never empty.
  const stagePosition = positions[step.kind === "intro" ? 0 : step.position];
  const turnout = useCountUp(snapshot.ballotsCast);

  // Scene lifetime.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = createRevealStage(canvas, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    controllerRef.current = stage.controller;
    stage.controller.onProgress((indexes, done) => {
      setStopped(new Set(indexes));
      setFinished(done);
    });
    // Labels follow the pedestals every frame — written straight to the DOM, no re-render.
    stage.controller.onFrame((anchors: LabelAnchor[]) => {
      anchors.forEach((anchor, index) => {
        const label = labelRefs.current[index];
        if (!label) return;
        label.style.transform = `translate(${anchor.x}px, 0) translateX(-50%)`;
        label.style.setProperty("--base-y", `${anchor.baseY}px`);
        label.style.setProperty("--top-y", `${anchor.topY}px`);
        label.style.opacity = anchor.dim ? "0.45" : "1";
      });
    });
    return () => stage.dispose();
  }, []);

  // A new position: new pedestals.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !stagePosition) return;
    controller.setCandidates(
      stagePosition.candidates.map((candidate) => ({ id: candidate.id, name: candidate.name, initials: initialsOf(candidate.name), photo: candidate.photo })),
    );
  }, [stagePosition]);

  // Each step sets the scene's targets.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (!position || step.kind === "intro") {
      controller.setStep({ kind: "intro" });
      return;
    }
    if (step.kind === "ready") {
      controller.setStep({ kind: "ready" });
      return;
    }
    controller.setStep({ kind: "race", ...raceOf(position.candidates.map((candidate) => candidate.votes)) });
  }, [step, position]);

  // Music starts with the host's first press (browsers block sound before a gesture).
  const ensureMusic = useCallback(() => {
    musicRef.current ??= createRevealMusic();
    musicRef.current.resume();
  }, []);
  useEffect(() => () => musicRef.current?.dispose(), []);

  // The music follows the show: calm on the start line, a speeding-up race, drumroll, fanfare.
  const raceStarted = step.kind === "race";
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    if (!raceStarted) {
      music.setMode("calm");
      return;
    }
    music.setMode("race");
    const total = REVEAL_RACE.duel + REVEAL_RACE.settle;
    const startedAt = performance.now();
    const ramp = window.setInterval(() => music.setIntensity((performance.now() - startedAt) / 1000 / total), 250);
    const roll = window.setTimeout(() => music.drumroll(REVEAL_RACE.settle + REVEAL_RACE.breakaway), REVEAL_RACE.duel * 1000);
    return () => {
      window.clearInterval(ramp);
      window.clearTimeout(roll);
    };
  }, [raceStarted, stepIndex]);
  useEffect(() => {
    if (finished) musicRef.current?.fanfare();
  }, [finished]);
  useEffect(() => musicRef.current?.setMuted(muted), [muted]);

  const go = useCallback((delta: number) => setStepIndex((index) => Math.min(Math.max(index + delta, 0), steps.length - 1)), [steps.length]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      ensureMusic();
      if (NEXT_KEYS.has(event.key)) {
        event.preventDefault();
        go(1);
      } else if (event.key.toLowerCase() === "m" || event.key.toLowerCase() === "ь") {
        setMuted((value) => !value);
      } else if (PREVIOUS_KEYS.has(event.key)) {
        event.preventDefault();
        go(-1);
      } else if (event.key.toLowerCase() === "f" || event.key.toLowerCase() === "а") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [go, ensureMusic]);

  const handleClick = () => {
    ensureMusic();
    go(1);
  };
  const total = snapshot.ballotsCast;
  const votes = position?.candidates.map((candidate) => candidate.votes) ?? [];
  const best = Math.max(...votes, 0);
  const winnerCount = votes.filter((count) => count === best).length;
  const isWinnerStep = step.kind === "race" && finished;
  const isLast = stepIndex === steps.length - 1;
  const titleRef = useEnter<HTMLHeadingElement>(position ? `${position.id}` : "intro");
  const bannerRef = useEnter<HTMLParagraphElement>(`${stepIndex}`, POP, 900);
  const revealed = step.kind === "race" ? stopped : new Set<number>();
  const winnerName = position?.candidates.find((candidate) => candidate.votes === best)?.name ?? "";

  return (
    <div className="fixed inset-0 cursor-pointer overflow-hidden bg-[#07070b] text-white select-none" onClick={handleClick}>
      <canvas ref={canvasRef} className="theme-scene" aria-hidden="true" />
      {/* Cinematic vignette. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.65)_100%)]" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-[0.8vh] pt-[3vh] text-center [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]">
        <p className="text-sm tracking-[0.35em] text-white/70 uppercase">Результати</p>
        <h1 ref={titleRef} className="text-[clamp(26px,6vh,64px)] leading-tight font-semibold tracking-tight">
          {position ? position.title : snapshot.title}
        </h1>
        {isWinnerStep && (
          <p ref={bannerRef} className="text-[clamp(18px,3.4vh,40px)] font-semibold text-[#ffc94d]">
            {winnerCount > 1 ? "Нічия!" : `Перемагає: ${winnerName}`}
          </p>
        )}
        {step.kind === "race" && !finished && (
          <p ref={bannerRef} className="animate-pulse text-[clamp(16px,2.8vh,32px)] text-white/85">
            Хто ж переможе?
          </p>
        )}
      </header>

      {/* Always mounted: the turnout fades and lifts away into the stage instead of cutting. */}
      <div
        className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[1.5vh] text-center transition-[opacity,transform,filter] duration-1000 ease-out [text-shadow:0_2px_14px_rgba(0,0,0,0.95)] ${
          step.kind === "intro" ? "opacity-100" : "-translate-y-[6vh] scale-90 opacity-0 blur-sm"
        }`}
      >
        <p className="text-[clamp(26px,4.4vh,48px)]">Проголосувало</p>
        <p className="text-[clamp(90px,20vh,220px)] leading-none font-semibold tabular-nums">{Math.round(turnout)}</p>
      </div>

      {position &&
        step.kind !== "intro" &&
        position.candidates.map((candidate, index) => {
          const isWinner = isWinnerStep && candidate.votes === best;
          return (
            <div
              key={candidate.id}
              ref={(element) => {
                labelRefs.current[index] = element;
              }}
              className="pointer-events-none absolute top-0 left-0 w-[240px] transition-opacity duration-700"
            >
              {/* Numbers float above the photo; the name sits at the pedestal's foot. Opacity follows the dimming. */}
              <div className="absolute left-0 w-full -translate-y-full text-center" style={{ top: "var(--top-y)" }}>
                <Scoreline votes={candidate.votes} total={total} visible={revealed.has(index)} />
              </div>
              <div className="absolute left-0 w-full pt-3 text-center" style={{ top: "var(--base-y)" }}>
                <span
                  className={`inline-block rounded-xl bg-black/55 px-[1.6vh] py-[0.6vh] text-[clamp(15px,2.6vh,28px)] leading-snug backdrop-blur-sm ${isWinner ? "font-semibold text-[#ffc94d]" : "text-white"}`}
                >
                  {candidate.name}
                </span>
              </div>
            </div>
          );
        })}

      <p className="pointer-events-none absolute right-6 bottom-5 text-xs text-white/30">
        {isLast ? "Кінець · ← назад" : `Пробіл / клік — далі · ← назад · F — на весь екран · M — звук ${muted ? "вимк." : "увімк."}`}
      </p>
    </div>
  );
};
