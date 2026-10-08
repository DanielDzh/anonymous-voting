"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GAME_SCORES_EVENT, GAME_STAGE_HEIGHT, HERO_MAX_PEOPLE, HERO_STAGE_HEIGHT } from "@/config/visuals";
import { themeGameHint } from "@/themes/registry";
import { SCENE_LOADERS } from "@/themes/scene-loaders";
import type { StagePerson, ThemeId } from "@/themes/types";
import { isLowPowerDevice } from "./device-tier";



/*
 * Sizing is inline on purpose: the canvas is absolutely positioned, so its pixel size can
 * never feed back into the box's size. (Without that, renderer resize → taller box →
 * ResizeObserver → bigger canvas… grew the page to 16 million pixels.)
 */
const SCENE_STYLE: CSSProperties = { position: "relative", height: HERO_STAGE_HEIGHT, overflow: "hidden" };
const GAME_SCENE_STYLE: CSSProperties = { ...SCENE_STYLE, height: GAME_STAGE_HEIGHT };
const GAME_HINT = "Потягни пальцем назад і відпусти — влуч у свого кандидата";
const SCORE_HINT = "Потягни пальцем назад і відпусти. За кого більше закинеш — за того й голос (нічия — ніхто)";
const CANVAS_STYLE: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

type HeroPerson = { id: string; name: string; photo: string | null };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

type HeroStageProps = {
  theme: ThemeId;
  people: HeroPerson[];
  /** A playable stage (cannon): taller, names above the targets, aiming hint below. */
  game?: boolean;
};

/**
 * A boxed 3D scene in the page header (not a full-screen background), so it never sits
 * under the ballot. Names are plain HTML under each character: crisp and accessible.
 */
export const HeroStage = ({ theme, people, game = false }: HeroStageProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shown = people.slice(0, HERO_MAX_PEOPLE);
  // Stable key: re-create the scene only when who is on stage (or their photo) changes.
  const peopleKey = shown.map((person) => `${person.id}:${person.photo?.length ?? 0}`).join("|");
  // Scoring games (Кільце) report their tally; other scenes never do, so no counter shows.
  const [scores, setScores] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!game) return;
    const handleScores = (event: Event) => setScores((event as CustomEvent<{ scores: Record<string, number> }>).detail.scores);
    window.addEventListener(GAME_SCORES_EVENT, handleScores);
    return () => window.removeEventListener(GAME_SCORES_EVENT, handleScores);
  }, [game]);

  useEffect(() => {
    const loader = SCENE_LOADERS[theme];
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!loader || !canvas || !box) return;

    let dispose: (() => void) | undefined;
    let cancelled = false;
    const stagePeople: StagePerson[] = shown.map((person) => ({ id: person.id, initials: initialsOf(person.name), photo: person.photo }));

    loader()
      .then((module) => {
        if (cancelled) return;
        dispose = module.default(
          canvas,
          {
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            lowPower: isLowPowerDevice(),
            photos: stagePeople.flatMap((person) => (person.photo ? [person.photo] : [])),
            people: stagePeople,
          },
          box,
        );
      })
      .catch((error: unknown) => console.error("[hero-stage]", error));

    return () => {
      cancelled = true;
      dispose?.();
    };
    // peopleKey stands in for `shown`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, peopleKey]);

  if (shown.length === 0) return null;

  const best = scores ? Math.max(...Object.values(scores)) : 0;
  const leaders = scores ? Object.values(scores).filter((value) => value === best).length : 0;
  const isLeader = (id: string) => best > 0 && leaders === 1 && scores?.[id] === best;

  const names = (
    <ul className="hero-stage__names">
      {shown.map((person) => (
        <li key={person.id}>
          {person.name}
          {scores && (
            <span className={`hero-stage__score${isLeader(person.id) ? " is-leading" : ""}`} aria-label={`влучань: ${scores[person.id] ?? 0}`}>
              {scores[person.id] ?? 0}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`hero-stage rise3d${game ? " hero-stage--game" : ""}`} style={{ "--hero-columns": shown.length } as CSSProperties}>
      {game && names}
      <div ref={boxRef} className="hero-stage__scene" style={game ? GAME_SCENE_STYLE : SCENE_STYLE}>
        <canvas ref={canvasRef} className="hero-stage__canvas" style={CANVAS_STYLE} aria-hidden="true" />
      </div>
      {game ? <p className="hero-stage__hint">{themeGameHint(theme) ?? (scores ? SCORE_HINT : GAME_HINT)}</p> : names}
    </div>
  );
};
