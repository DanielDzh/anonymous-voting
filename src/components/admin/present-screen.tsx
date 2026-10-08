"use client";

import { useCountUp } from "@/components/results/use-count-up";
import { ThemeScene } from "@/components/three-d/theme-scene";
import { useTilt } from "@/components/three-d/use-tilt";
import { DisplayTitle } from "@/components/ui/display-title";
import { formatCode } from "@/lib/code-format";
import type { AdminSnapshot } from "@/lib/view-models";
import { themeStage, themeUsesPhotos } from "@/themes/registry";
import { GameScoreboard } from "./game-scoreboard";
import { useLiveStats } from "./use-live-stats";

const PHASE_HINTS: Record<AdminSnapshot["phase"], string> = {
  draft: "Голосування скоро відкриється",
  open: "Скануйте QR або введіть код",
  closed: "Голосування завершено",
  results: "Результати опубліковано",
};

const TITLE_CLASS = "text-[clamp(40px,5.5vw,96px)]";
/** Cannon themes use a very wide display font: smaller, so a long word doesn't break mid-word. */
const GAME_TITLE_CLASS = "text-[clamp(32px,3.8vw,80px)]";

type PresentScreenProps = { snapshot: AdminSnapshot };

/** Projector view: the voter theme with its 3D scene, a huge QR, the code and a live ballot counter. */
export const PresentScreen = ({ snapshot }: PresentScreenProps) => {
  // Light polling of counters only; the page re-renders just when title/theme/phase/code change.
  const live = useLiveStats(snapshot.id, {
    title: snapshot.title,
    theme: snapshot.theme,
    phase: snapshot.phase,
    accessCode: snapshot.accessCode,
    ballotsCast: snapshot.ballotsCast,
    gamePoints: Object.fromEntries(snapshot.gamePoints.map((entry) => [entry.id, entry.points])),
  });
  const tiltRef = useTilt<HTMLDivElement>(6);
  const shownCount = useCountUp(live.ballotsCast);
  const gamePoints = snapshot.gamePoints.map((entry) => ({ ...entry, points: live.gamePoints[entry.id] ?? entry.points }));
  const joinHost = new URL(snapshot.joinUrl).host;
  const usesPhotos = themeUsesPhotos(snapshot.theme);
  const isGame = themeStage(snapshot.theme) === "game";
  const photos = usesPhotos
    ? snapshot.results
        .flatMap((position) => position.candidates.map((candidate) => candidate.photo))
        .filter((photo): photo is string => Boolean(photo))
    : [];

  return (
    <div className="theme-root flex items-center" data-theme={snapshot.theme}>
      {/* The cannon game is for phones; on the projector it would just sit there — keep the screen clean. */}
      {!isGame && <ThemeScene theme={snapshot.theme} photos={photos} />}
      <main className="stage grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rise3d flex flex-col gap-6">
          <p className="tag">{PHASE_HINTS[snapshot.phase]}</p>
          <DisplayTitle text={snapshot.title} className={isGame ? GAME_TITLE_CLASS : TITLE_CLASS} />
          <div className="flex flex-col gap-1">
            <span className="tag">Код голосування</span>
            <span className="font-mono text-[clamp(40px,5.5vw,88px)] leading-none font-semibold tracking-[0.12em] whitespace-nowrap">
              {formatCode(snapshot.accessCode)}
            </span>
            <span className="text-lg text-muted">{joinHost}</span>
          </div>
          <p className="heading text-3xl">
            Проголосувало: <span className="tabular-nums text-[color:var(--accent)]">{Math.round(shownCount)}</span>
          </p>
          {isGame && (
            <div className="w-full max-w-[560px]">
              <GameScoreboard entries={gamePoints} />
            </div>
          )}
        </div>

        <div className="rise3d">
          <div
            ref={tiltRef}
            className="tilt aspect-square w-[min(38vw,480px)] max-lg:w-[min(80vw,420px)] rounded-[28px] bg-white p-4 shadow-2xl [&_svg]:h-full [&_svg]:w-full"
            role="img"
            aria-label={`QR-код: ${snapshot.joinUrl}`}
            // Server-rendered by the qrcode library from our own URL.
            dangerouslySetInnerHTML={{ __html: snapshot.qrSvg }}
          />
        </div>
      </main>
    </div>
  );
};
