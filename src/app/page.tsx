import { Suspense } from "react";
import { ResultsBoard } from "@/components/results/results-board";
import { HeroStage } from "@/components/three-d/hero-stage";
import { HERO_MAX_PEOPLE } from "@/config/visuals";
import { ThemeScene } from "@/components/three-d/theme-scene";
import { DisplayTitle } from "@/components/ui/display-title";
import { CodeStep } from "@/components/voting/code-step";
import { PhaseNotice } from "@/components/voting/phase-notice";
import { VotingFlow } from "@/components/voting/voting-flow";
import { CODE_QUERY_PARAM, PHASE_LABELS } from "@/config/voting";
import { getPublicView } from "@/lib/queries";
import type { PublicSnapshot } from "@/lib/view-models";
import { ENTRY_THEME, themeStage, themeUsesPhotos } from "@/themes/registry";

type SearchParams = PageProps<"/">["searchParams"];

const readLinkCode = async (searchParams: SearchParams): Promise<string | null> => {
  const value = (await searchParams)[CODE_QUERY_PARAM];
  return typeof value === "string" ? value : null;
};

/** Photos of everyone on screen, in ballot order — the 3D scene of photo themes builds from these. */
const photosOf = (snapshot: PublicSnapshot): string[] =>
  [...snapshot.ballot, ...(snapshot.results ?? [])]
    .flatMap((position) => position.candidates.map((candidate) => candidate.photo))
    .filter((photo): photo is string => Boolean(photo));

/** Everyone on the ballot (or in the results), for hero stages: one character each. */
const peopleOf = (snapshot: PublicSnapshot) =>
  [...snapshot.ballot, ...(snapshot.results ?? [])].flatMap((position) =>
    position.candidates.map(({ id, name, photo }) => ({ id, name, photo })),
  );

const FOOTER = "Один код — один голос · Хто за кого голосував, не знає ніхто";

/** No code yet (or a wrong one): just the code form — which votings exist stays private. */
const EntryView = ({ codeRejected }: { codeRejected: boolean }) => (
  <div className="theme-root" data-theme={ENTRY_THEME}>
    <ThemeScene theme={ENTRY_THEME} />
    <main className="stage">
      <header className="rise3d mb-12 flex flex-col gap-5 sm:mb-16">
        <p className="tag">Анонімне голосування</p>
        <DisplayTitle text="Введіть код" className="text-[clamp(44px,10vw,120px)]" />
      </header>
      <div className="flex flex-col gap-4">
        {codeRejected && (
          <p className="error mx-auto" role="alert">
            Код у посиланні невірний або застарів — введіть актуальний код
          </p>
        )}
        <CodeStep />
      </div>
      <p className="tag mt-24 text-center">{FOOTER}</p>
    </main>
  </div>
);

const VoterView = async ({ searchParams }: { searchParams: SearchParams }) => {
  const view = await getPublicView(await readLinkCode(searchParams));
  if (view.kind === "entry") return <EntryView codeRejected={view.codeRejected} />;
  const { snapshot } = view;
  const usesPhotos = themeUsesPhotos(snapshot.theme);
  const stage = themeStage(snapshot.theme);
  // Hero and game themes draw their scene in a box under the title instead of a full-screen background.
  const isHero = stage !== "background";
  // Cannon themes vote by shooting only — as long as every candidate has a target on the stage
  // (one position, up to HERO_MAX_PEOPLE). Otherwise the cards come back so nobody is stuck.
  const gameOnly =
    stage === "game" && snapshot.ballot.length === 1 && snapshot.ballot[0].candidates.length <= HERO_MAX_PEOPLE;

  return (
    <div className="theme-root" data-theme={snapshot.theme}>
      {!isHero && <ThemeScene theme={snapshot.theme} photos={usesPhotos ? photosOf(snapshot) : []} />}
      <main className="stage">
        <header className="rise3d mb-12 flex flex-col gap-5 sm:mb-16">
          <p className="tag flex flex-wrap items-center gap-3">
            Анонімне голосування
            <span className="rounded-full border border-[color:var(--surface-border)] px-3 py-1 text-fg">
              {PHASE_LABELS[snapshot.phase]}
            </span>
          </p>
          <DisplayTitle text={snapshot.title} className="text-[clamp(44px,10vw,120px)]" />
        </header>

        {isHero && <HeroStage theme={snapshot.theme} people={peopleOf(snapshot)} game={stage === "game"} />}

        {snapshot.phase === "draft" && (
          <PhaseNotice heading="Скоро старт" text="Голосування ще не відкрите. Коли його відкриють, відскануйте QR або введіть код від організатора." />
        )}

        {snapshot.phase === "open" && (
          <VotingFlow
            // A different voting (new code) starts its flow from scratch.
            key={snapshot.code}
            code={snapshot.code}
            positions={snapshot.ballot}
            alreadyVoted={snapshot.alreadyVoted}
            gameOnly={gameOnly}
          />
        )}

        {snapshot.phase === "closed" && (
          <PhaseNotice heading="Голосування завершено" text="Прийом голосів закрито. Результати з'являться тут після публікації." />
        )}

        {snapshot.phase === "results" && snapshot.results && (
          <div className="flex flex-col gap-5">
            <p className="tag">Усього бюлетенів: {snapshot.ballotsCast}</p>
            <ResultsBoard positions={snapshot.results} />
          </div>
        )}

        <p className="tag mt-24 text-center">{FOOTER}</p>
      </main>
    </div>
  );
};

const LoadingShell = () => (
  <main className="stage">
    <p className="tag animate-pulse">Завантаження…</p>
  </main>
);

const HomePage = ({ searchParams }: PageProps<"/">) => (
  <Suspense fallback={<LoadingShell />}>
    <VoterView searchParams={searchParams} />
  </Suspense>
);

export default HomePage;
