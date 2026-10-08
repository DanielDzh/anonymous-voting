"use client";

import Link from "next/link";
import { ResultsBoard } from "@/components/results/results-board";
import { DisplayTitle } from "@/components/ui/display-title";
import type { AdminSnapshot } from "@/lib/view-models";
import { AccessPanel } from "./access-panel";
import { DeleteVoting } from "./delete-voting";
import { PhaseControl } from "./phase-control";
import { PositionsEditor } from "./positions-editor";
import { StatsStrip } from "./stats-strip";
import { ThemePicker } from "./theme-picker";
import { TitleForm } from "./title-form";
import { useLiveRefresh } from "./use-live-refresh";
import { VotingIdProvider } from "./voting-context";

type AdminDashboardProps = { snapshot: AdminSnapshot };

export const AdminDashboard = ({ snapshot }: AdminDashboardProps) => {
  useLiveRefresh();

  return (
    <VotingIdProvider votingId={snapshot.id}>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="tag flex items-center gap-3">
              <span className="pulse-dot" aria-hidden="true" /> Панель
              адміністратора · наживо
            </p>
            <Link href="/admin" className="btn btn--ghost btn--small">
              ← Усі голосування
            </Link>
          </div>
          <DisplayTitle
            text={snapshot.title}
            className="text-[clamp(32px,7vw,88px)]"
          />
        </header>

        <StatsStrip ballotsCast={snapshot.ballotsCast} phase={snapshot.phase} />

        <AccessPanel
          accessCode={snapshot.accessCode}
          joinUrl={snapshot.joinUrl}
          qrSvg={snapshot.qrSvg}
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <PhaseControl phase={snapshot.phase} />
          <TitleForm title={snapshot.title} />
        </div>

        <ThemePicker current={snapshot.theme} />

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="tag">
              Результати наживо{" "}
              {snapshot.phase !== "results" && "· бачите лише ви"}
            </p>
            {/* The show is for after voting: it reveals the final numbers on the projector. */}
            {(snapshot.phase === "closed" || snapshot.phase === "results") && (
              <a href={`/admin/v/${snapshot.id}/reveal`} target="_blank" rel="noreferrer" className="btn btn--small">
                Шоу результатів ↗
              </a>
            )}
          </div>
          <ResultsBoard positions={snapshot.results} />
        </section>

        <PositionsEditor
          positions={snapshot.results}
          editable={snapshot.phase === "draft"}
        />

        <DeleteVoting title={snapshot.title} />
      </div>
    </VotingIdProvider>
  );
};
