"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BaseloadLogo from "@/components/marketing/BaseloadLogo";
import { getAccessState, type AccessState } from "@/lib/access";
import type { IndustrialTrackerCoverageDashboard } from "@/lib/industrial-tracker/coverage-dashboard";

function freshnessClass(freshness: "fresh" | "aging" | "stale" | "scheduled") {
  if (freshness === "scheduled") return "text-sky-200 border-sky-400/20 bg-sky-400/10";
  if (freshness === "fresh") return "text-emerald-300 border-emerald-400/20 bg-emerald-400/10";
  if (freshness === "aging") return "text-amber-200 border-amber-400/20 bg-amber-400/10";
  return "text-rose-200 border-rose-400/20 bg-rose-400/10";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function IndustrialTrackerCoveragePage() {
  const [access, setAccess] = useState<AccessState>({ loggedIn: false, plan: "public" });
  const [dashboard, setDashboard] = useState<IndustrialTrackerCoverageDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAccess(getAccessState());
    fetch("/api/industrial-opportunity-tracker/coverage")
      .then((response) => response.json())
      .then((data) => setDashboard(data))
      .finally(() => setLoading(false));
  }, []);

  const canView = access.loggedIn && access.plan !== "public";

  return (
    <div className="min-h-screen bg-[#071019] px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-4">
          <BaseloadLogo href="/" />
          <div className="flex items-center gap-3">
            <Link
              href="/industrial-tracker"
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60"
            >
              Tracker
            </Link>
            <Link
              href={canView ? "/inventory" : "/auth"}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60"
            >
              {canView ? "Mission Map" : "Login"}
            </Link>
          </div>
        </header>

        <main className="mt-12">
          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="max-w-4xl">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Internal Coverage</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
                Measure what the graph actually knows.
              </h1>
            </div>
            <div className="rounded-[28px] border border-slate-800 bg-[linear-gradient(180deg,rgba(8,18,28,0.98),rgba(11,24,35,0.88))] p-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Operating Surface</div>
              <div className="mt-3 text-sm text-slate-300">
                Internal only. Use this to track source freshness, coverage quality, and where the landscape is still thin.
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  {dashboard?.mode || "loading"}
                </span>
                {dashboard ? (
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                    {formatDate(dashboard.generatedAt)}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          {!canView ? (
            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Restricted</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Sign in to view internal source health.</h2>
                <p className="mt-3 text-sm text-slate-300">
                  This page is for Baseload operating visibility, not the public demo surface.
                </p>
                <Link
                  href="/auth"
                  className="mt-5 inline-flex rounded-md bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                >
                  Open access
                </Link>
              </div>
            </section>
          ) : loading || !dashboard ? (
            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
              Loading coverage dashboard…
            </section>
          ) : (
            <>
              <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {dashboard.coverageMetrics.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{item.value}</div>
                    <div className="mt-2 text-sm text-slate-400">{item.note}</div>
                  </div>
                ))}
              </section>

              <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Source Health</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Freshness and volume</h2>
                </div>

                <div className="mt-4 grid gap-3">
                  {dashboard.sourceHealth.map((item) => (
                    <div
                      key={item.sourceName}
                      className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr_0.9fr]"
                    >
                      <div>
                        <div className="font-medium text-white">{item.sourceName}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          {item.category.replace(/_/g, " ")}
                        </div>
                      </div>
                      <div className="text-sm text-slate-300">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Source rows</div>
                        <div className="mt-1 text-lg font-semibold text-white">{item.sourceRecords.toLocaleString()}</div>
                      </div>
                      <div className="text-sm text-slate-300">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Evidence</div>
                        <div className="mt-1 text-lg font-semibold text-white">{item.evidenceRecords.toLocaleString()}</div>
                      </div>
                      <div className="text-sm text-slate-300">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last seen</div>
                        <div className="mt-1 text-sm text-white">{formatDate(item.latestObservedAt)}</div>
                      </div>
                      <div className="flex items-center md:justify-end">
                        <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${freshnessClass(item.freshness)}`}>
                          {item.freshness}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <TagPanel title="Top Tech Tags" items={dashboard.topTechTags} />
                <TagPanel title="Top Project Sectors" items={dashboard.topProjectSectors} />
                <TagPanel title="Top Queue Utilities" items={dashboard.topQueueUtilities} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TagPanel({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{title}</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-sm text-white">{item.label.replace(/_/g, " ")}</div>
            <div className="text-sm font-semibold text-cyan-300">{item.count.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
