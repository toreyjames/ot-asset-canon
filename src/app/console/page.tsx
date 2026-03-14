"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAccessState, getOnboardingState } from "@/lib/access";

interface IngestRunSummary {
  source?: string;
  siteName?: string;
  capturedAt?: string;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDate(value?: string) {
  if (!value) return "No run yet";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "No run yet";
  return ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConsolePage() {
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [company, setCompany] = useState<string | null>(null);
  const [ingestSummary, setIngestSummary] = useState<IngestRunSummary | null>(null);

  useEffect(() => {
    const access = getAccessState();
    const onboarding = getOnboardingState();

    setIsLoggedIn(access.loggedIn);
    setOnboardingComplete(onboarding.completed);
    setCompany(onboarding.company || access.company || null);

    try {
      const raw = window.sessionStorage.getItem("planttrace:lastIngestRun");
      if (raw) {
        setIngestSummary(JSON.parse(raw) as IngestRunSummary);
      }
    } catch {
      setIngestSummary(null);
    }

    setReady(true);
  }, []);

  const orgSlug = useMemo(() => slugify(company || ""), [company]);
  const ingestHref = orgSlug ? `/ingest?orgSlug=${encodeURIComponent(orgSlug)}` : "/ingest";

  const assessStatus = onboardingComplete ? "Complete" : "Required";
  const mapStatus = ingestSummary ? "In Progress" : "Not Started";
  const contextStatus = onboardingComplete ? "Ready" : "Blocked";

  if (!ready) {
    return <div className="industrial-spec min-h-screen bg-[#060606] text-zinc-100" />;
  }

  return (
    <div className="industrial-spec min-h-screen bg-[#060606] text-zinc-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="spec-block p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="spec-eyebrow">Baseload Console</p>
              <h1 className="spec-title mt-2">Client Workflow Command</h1>
              <p className="spec-body mt-2 max-w-2xl">
                Assess first, map second, contextualize third. One workspace, one sequence.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <span className="spec-status">ACCESS: ACTIVE</span>
              ) : (
                <Link href="/auth?returnTo=/console" className="spec-link">
                  LOGIN
                </Link>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="spec-block p-5">
            <div className="spec-section-label">Phase 0 - Assess</div>
            <p className="spec-body mt-2">Define company context, industry scope, and privacy defaults.</p>
            <div className="mt-3 spec-cell-label">Status</div>
            <div className="spec-cell-value mt-1">{assessStatus}</div>
            <div className="mt-4">
              <Link href={isLoggedIn ? "/onboarding" : "/auth?returnTo=/onboarding"} className="spec-link">
                {onboardingComplete ? "Edit Assessment" : "Start Assessment"}
              </Link>
            </div>
          </article>

          <article className="spec-block p-5">
            <div className="spec-section-label">Phase 1 - Mission Map</div>
            <p className="spec-body mt-2">Run data gathering agent with checks, logs, and map formation.</p>
            <div className="mt-3 spec-cell-label">Status</div>
            <div className="spec-cell-value mt-1">{mapStatus}</div>
            <div className="mt-2 text-xs text-zinc-400">Last run: {formatDate(ingestSummary?.capturedAt)}</div>
            <div className="mt-4 flex gap-2">
              <Link href={isLoggedIn ? ingestHref : "/auth?returnTo=/ingest"} className="spec-link">
                Open Agent
              </Link>
              <Link href={isLoggedIn ? "/inventory" : "/auth?returnTo=/inventory"} className="spec-link">
                Inventory
              </Link>
            </div>
          </article>

          <article className="spec-block p-5">
            <div className="spec-section-label">Phase 2 - Context</div>
            <p className="spec-body mt-2">Compare site/facility posture against live external opportunity signals.</p>
            <div className="mt-3 spec-cell-label">Status</div>
            <div className="spec-cell-value mt-1">{contextStatus}</div>
            <div className="mt-4">
              <Link
                href={isLoggedIn ? "/industrial-tracker/coverage" : "/auth?returnTo=/industrial-tracker/coverage"}
                className="spec-link"
              >
                Open Industry Context
              </Link>
            </div>
          </article>
        </section>

        <section className="spec-block p-6">
          <div className="spec-section-label">Workspace Snapshot</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="spec-table-surface p-3">
              <div className="spec-cell-label">Company</div>
              <div className="spec-cell-value mt-1">{company || "Not set"}</div>
            </div>
            <div className="spec-table-surface p-3">
              <div className="spec-cell-label">Org Slug</div>
              <div className="spec-cell-value mt-1">{orgSlug || "Not set"}</div>
            </div>
            <div className="spec-table-surface p-3">
              <div className="spec-cell-label">Latest Source</div>
              <div className="spec-cell-value mt-1">{ingestSummary?.source || "No run yet"}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
