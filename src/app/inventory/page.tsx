"use client";

import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { type CanonAsset } from "@/types/canon";
import type { CompletenessResult, GapAnalysis, PlantType } from "@/lib/inventory-completeness";
import type { SiteProfile } from "@/lib/synthetic-site-generator";
import Link from "next/link";
import { getAccessState, type AccessState } from "@/lib/access";

const Plant3DView = lazy(() => import("@/components/canon/Plant3DView"));

const PLANT_TYPE_LABELS: Record<PlantType, string> = {
  chemical: "Chemical Plant",
  petrochemical: "Petrochemical Plant",
  refinery: "Oil Refinery",
  power_generation: "Power Generation",
  water_treatment: "Water Treatment",
  wastewater: "Wastewater Treatment",
  pharmaceutical: "Pharmaceutical",
  food_beverage: "Food & Beverage",
  pulp_paper: "Pulp & Paper",
  metals_mining: "Metals & Mining",
  oil_gas_upstream: "Oil & Gas (Upstream)",
  oil_gas_midstream: "Oil & Gas (Midstream)",
  manufacturing: "Manufacturing",
  unknown: "Unknown",
};

type DemoPresetKey =
  | "refinery"
  | "chemical"
  | "water"
  | "power"
  | "automotive"
  | "defense_manufacturing"
  | "shipbuilding";

const DEMO_PRESETS: {
  key: DemoPresetKey;
  label: string;
  profile: SiteProfile;
  siteName: string;
  siteSlug: string;
  targetAssetCount: number;
}[] = [
  {
    key: "refinery",
    label: "Refinery",
    profile: "petrochemical",
    siteName: "Gulf Coast Refinery",
    siteSlug: "gulf-coast-refinery",
    targetAssetCount: 3200,
  },
  {
    key: "chemical",
    label: "Chemical Plant",
    profile: "chemical",
    siteName: "Prairie Chemical Works",
    siteSlug: "prairie-chemical-works",
    targetAssetCount: 2800,
  },
  {
    key: "water",
    label: "Water Treatment",
    profile: "water",
    siteName: "Riverbend Water Facility",
    siteSlug: "riverbend-water-facility",
    targetAssetCount: 2400,
  },
  {
    key: "power",
    label: "Power Generation",
    profile: "power",
    siteName: "Summit Power Station",
    siteSlug: "summit-power-station",
    targetAssetCount: 2600,
  },
  {
    key: "automotive",
    label: "Automotive",
    profile: "automotive",
    siteName: "Midwest Auto Assembly",
    siteSlug: "midwest-auto-assembly",
    targetAssetCount: 3000,
  },
  {
    key: "defense_manufacturing",
    label: "Defense Manufacturing",
    profile: "defense_manufacturing",
    siteName: "Patriot Defense Works",
    siteSlug: "patriot-defense-works",
    targetAssetCount: 2800,
  },
  {
    key: "shipbuilding",
    label: "Shipbuilding",
    profile: "shipbuilding",
    siteName: "Atlantic Shipyard",
    siteSlug: "atlantic-shipyard",
    targetAssetCount: 3400,
  },
];

const DEMO_STEPS = [
  "Generating plant dataset",
  "Building canonical inventory",
  "Calculating security coverage",
  "Rendering plant map",
];

interface AnalysisPayload {
  site: {
    siteName: string;
    siteSlug: string;
    profile: SiteProfile;
    targetAssetCount: number;
    generatedAssetCount: number;
    generatedAt: string;
  };
  dataset: {
    totalAssets: number;
    visualizationAssets: number;
  };
  coverageBaseline: {
    totalAssets: number;
    securableAssets: number;
    coveredAssets: number;
    uncoveredAssets: number;
    coveragePercent: number;
    discoveryCoveragePercent: number;
    patchVisibilityPercent: number;
    evidencedPercent: number;
  };
  completeness: CompletenessResult;
  gaps: GapAnalysis;
  assets: Partial<CanonAsset>[];
}

interface IngestRunContext {
  source: string;
  siteName: string;
  siteSlug: string;
  profile?: string;
  records: Record<string, unknown>[];
  capturedAt: string;
}

interface RunHistoryEntry {
  siteName: string;
  siteSlug: string;
  profile: string;
  assets: number;
  generatedAt: string;
}

function normalizeProfile(input: string | null): SiteProfile {
  if (!input) return "petrochemical";
  if (
    input === "petrochemical" ||
    input === "chemical" ||
    input === "water" ||
    input === "power" ||
    input === "automotive" ||
    input === "defense_manufacturing" ||
    input === "shipbuilding"
  ) {
    return input;
  }
  if (input.includes("auto")) return "automotive";
  if (input.includes("defense")) return "defense_manufacturing";
  if (input.includes("ship")) return "shipbuilding";
  if (input.includes("water")) return "water";
  if (input.includes("power")) return "power";
  if (input.includes("refinery")) return "petrochemical";
  return "chemical";
}

export default function InventoryPage() {
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autostarted, setAutostarted] = useState(false);
  const [fromIngest, setFromIngest] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoPreset, setDemoPreset] = useState<DemoPresetKey>("refinery");
  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStatus, setDemoStatus] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState>({ loggedIn: false, plan: "public" });

  const [siteName, setSiteName] = useState("Houston Plant");
  const [siteSlug, setSiteSlug] = useState("houston-plant");
  const [profile, setProfile] = useState<SiteProfile>("petrochemical");
  const [targetAssetCount, setTargetAssetCount] = useState(2400);

  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState<"all" | "networked" | "non_networked">("all");

  const completeness = analysis?.completeness;
  const gaps = analysis?.gaps;

  const totalGaps = useMemo(() => {
    if (!completeness) return 0;
    return completeness.layerScores.reduce((sum, l) => sum + l.gaps.length, 0);
  }, [completeness]);

  const criticalGaps = useMemo(() => {
    if (!completeness) return 0;
    return completeness.layerScores.flatMap((l) => l.gaps).filter((g) => g.severity === "critical").length;
  }, [completeness]);

  const topCriticalGaps = useMemo(() => {
    if (!completeness) return [];
    return completeness.layerScores
      .flatMap((l) => l.gaps.map((g) => ({ ...g, layer: l.layer })))
      .filter((g) => g.severity === "critical")
      .slice(0, 8);
  }, [completeness]);

  const totalAssets = analysis?.dataset.totalAssets ?? 0;
  const expectedAssets = analysis?.site.targetAssetCount ?? 0;
  const realityGapAssets = Math.abs(totalAssets - expectedAssets);
  const discoveredCount = analysis
    ? Math.min(
        totalAssets,
        Math.round((analysis.coverageBaseline.discoveryCoveragePercent / 100) * totalAssets)
      )
    : 0;
  const evidenceBackedCount = analysis
    ? Math.min(
        totalAssets,
        Math.round((analysis.coverageBaseline.evidencedPercent / 100) * totalAssets)
      )
    : 0;

  const filteredAssets = useMemo(() => {
    if (!analysis) return [];
    const query = assetSearch.trim().toLowerCase();

    return analysis.assets.filter((asset) => {
      const isNetworked = Boolean(
        asset.network?.ipAddress ||
        asset.network?.zone ||
        asset.network?.vlan ||
        (asset.layer ?? 0) >= 3
      );

      if (networkFilter === "networked" && !isNetworked) return false;
      if (networkFilter === "non_networked" && isNetworked) return false;

      if (!query) return true;

      const haystack = [
        asset.tagNumber,
        asset.name,
        asset.assetType,
        asset.engineering?.processArea,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [analysis, assetSearch, networkFilter]);

  const canSaveAndExport = access.loggedIn && access.plan !== "public";

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function startFromIngestContext(context: IngestRunContext) {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/analysis/from-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: context.siteName,
          siteSlug: context.siteSlug,
          profile: context.profile,
          records: context.records,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze ingest context");
      }

      const payload = (await response.json()) as AnalysisPayload;
      setAnalysis(payload);
      setHandoffMessage(
        `Showing baseline from ingested records: ${context.records.length.toLocaleString()} records for ${context.siteName}.`
      );
    } catch {
      setError("Ingest handoff detected, but analysis could not be generated from that run.");
    } finally {
      setLoading(false);
    }
  }

  async function startAnalysis() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName,
          siteSlug,
          profile,
          targetAssetCount,
          visualizationAssetLimit: 450,
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis request failed");
      }

      const payload = (await response.json()) as AnalysisPayload;
      setAnalysis(payload);
    } catch {
      setError("Unable to run analysis. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  async function runGuidedDemo() {
    const preset = DEMO_PRESETS.find((p) => p.key === demoPreset) ?? DEMO_PRESETS[0];
    try {
      setDemoRunning(true);
      setLoading(true);
      setError(null);
      setDemoStepIndex(0);
      setDemoStatus(DEMO_STEPS[0]);

      setSiteName(preset.siteName);
      setSiteSlug(preset.siteSlug);
      setProfile(preset.profile);
      setTargetAssetCount(preset.targetAssetCount);

      await sleep(500);
      setDemoStepIndex(1);
      setDemoStatus(DEMO_STEPS[1]);
      await sleep(500);
      setDemoStepIndex(2);
      setDemoStatus(DEMO_STEPS[2]);

      const response = await fetch("/api/analysis/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: preset.siteName,
          siteSlug: preset.siteSlug,
          profile: preset.profile,
          targetAssetCount: preset.targetAssetCount,
          visualizationAssetLimit: 450,
        }),
      });

      if (!response.ok) {
        throw new Error("Demo analysis request failed");
      }

      setDemoStepIndex(3);
      setDemoStatus(DEMO_STEPS[3]);
      const payload = (await response.json()) as AnalysisPayload;
      await sleep(400);
      setAnalysis(payload);
      setDemoStatus("Demo ready");
    } catch {
      setError("Demo run failed. Please retry.");
      setDemoStatus(null);
    } finally {
      setLoading(false);
      setDemoRunning(false);
    }
  }

  useEffect(() => {
    setAccess(getAccessState());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      setDemoMode(true);
    }
    const from = params.get("from");
    if (from !== "ingest") return;
    setFromIngest(true);
    if (autostarted || analysis || loading) return;
    setAutostarted(true);

    const raw = window.sessionStorage.getItem("planttrace:lastIngestRun");
    if (!raw) {
      setHandoffMessage(
        "Ingest handoff requested, but no ingest payload was found in this browser session."
      );
      return;
    }

    try {
      const context = JSON.parse(raw) as IngestRunContext;
      if (!context.records?.length) {
        setHandoffMessage("Ingest payload found, but it did not include structured records.");
        return;
      }
      setSiteName(context.siteName || siteName);
      setSiteSlug(context.siteSlug || siteSlug);
      setTargetAssetCount(Math.min(8000, Math.max(200, context.records.length)));
      setProfile(normalizeProfile(context.profile || null));
      void startFromIngestContext(context);
    } catch {
      setHandoffMessage("Ingest payload could not be parsed.");
    }
  }, [autostarted, analysis, loading, siteName, siteSlug]);

  useEffect(() => {
    if (!analysis || !canSaveAndExport || typeof window === "undefined") return;

    const key = "planttrace:run_history";
    const current = window.localStorage.getItem(key);
    const history = current ? (JSON.parse(current) as Array<Record<string, string | number>>) : [];

    history.unshift({
      siteName: analysis.site.siteName,
      siteSlug: analysis.site.siteSlug,
      profile: analysis.site.profile,
      assets: analysis.dataset.totalAssets,
      generatedAt: analysis.site.generatedAt,
    });

    window.localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
  }, [analysis, canSaveAndExport]);

  function runPreset(preset: "pilot" | "enterprise") {
    if (preset === "pilot") {
      setSiteName("Pilot Plant");
      setSiteSlug("pilot-plant");
      setProfile("chemical");
      setTargetAssetCount(3200);
    } else {
      setSiteName("Enterprise Refining Complex");
      setSiteSlug("enterprise-refining-complex");
      setProfile("petrochemical");
      setTargetAssetCount(12000);
    }
  }

  if (!analysis) {
    if (demoMode && !fromIngest) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] text-slate-100 px-4 py-10">
          <div className="max-w-3xl mx-auto">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
              <h1 className="text-3xl font-bold text-white">Run Interactive Demo</h1>
              <p className="mt-3 text-slate-300">
                Choose a plant type, then watch the demo build inventory and coverage step by step.
              </p>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
                {DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setDemoPreset(preset.key)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      demoPreset === preset.key
                        ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-800/70 text-slate-300"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {DEMO_STEPS.map((step, idx) => {
                  const state =
                    demoRunning || loading
                      ? idx < demoStepIndex
                        ? "done"
                        : idx === demoStepIndex
                        ? "active"
                        : "pending"
                      : "pending";
                  return <AgentStep key={step} index={idx + 1} label={step} state={state} />;
                })}
              </div>

              {demoStatus && (
                <div className="mt-4 rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-200">
                  {demoStatus}
                </div>
              )}
              {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}

              <div className="mt-6">
                <button
                  onClick={runGuidedDemo}
                  disabled={demoRunning || loading}
                  className="px-5 py-2.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-semibold"
                >
                  {demoRunning || loading ? "Running Demo..." : "Run Demo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0a0a0f] text-slate-100 px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-white">Start Baseline Run</h1>
            {fromIngest && (
              <div className="mt-3 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                Ingest handoff detected. Inventory will use the exact ingest payload when available.
              </div>
            )}
            {handoffMessage && (
              <div className="mt-3 rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
                {handoffMessage}
              </div>
            )}
            <p className="mt-3 text-slate-400">
              Build an evidence-backed plant baseline and quantify wasted effort reduction.
              This run outputs inventory confidence, coverage gaps, and CMDB-ready data quality.
            </p>

            <div className="mt-6 grid md:grid-cols-2 gap-3">
              <button
                onClick={() => runPreset("pilot")}
                className="text-left rounded-xl border border-slate-700 bg-slate-800/70 p-4 hover:border-cyan-500/60"
              >
                <div className="text-sm font-semibold text-white">Quick Start: Pilot Site</div>
                <div className="text-xs text-slate-400 mt-1">~3,200 assets · fastest way to see full workflow</div>
              </button>
              <button
                onClick={() => runPreset("enterprise")}
                className="text-left rounded-xl border border-slate-700 bg-slate-800/70 p-4 hover:border-cyan-500/60"
              >
                <div className="text-sm font-semibold text-white">Quick Start: Enterprise Scale</div>
                <div className="text-xs text-slate-400 mt-1">~12,000 assets · shows large-scope ROI behavior</div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Site Name</div>
                <input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white"
                />
              </label>
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Site Slug</div>
                <input
                  value={siteSlug}
                  onChange={(e) => setSiteSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white"
                />
              </label>
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Profile</div>
                <select
                  value={profile}
                  onChange={(e) => setProfile(e.target.value as SiteProfile)}
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white"
                >
                  <option value="petrochemical">Petrochemical</option>
                  <option value="chemical">Chemical</option>
                  <option value="water">Water Treatment</option>
                  <option value="power">Power Generation</option>
                  <option value="automotive">Automotive</option>
                  <option value="defense_manufacturing">Defense Manufacturing</option>
                  <option value="shipbuilding">Shipbuilding</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Target Asset Count ({targetAssetCount})</div>
                <input
                  type="range"
                  min={200}
                  max={8000}
                  step={100}
                  value={targetAssetCount}
                  onChange={(e) => setTargetAssetCount(Number(e.target.value))}
                  className="w-full"
                />
              </label>
            </div>

            {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}

            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={startAnalysis}
                disabled={loading}
                className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium"
              >
                {loading ? "Running Baseline..." : "Run Baseline"}
              </button>
              <div className="text-xs text-slate-500">
                Server-side generation + analysis. Returns sampled visualization with full KPI outputs.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="relative">
        <div className={`${mapCollapsed ? "h-[88px]" : "w-full h-[70vh] min-h-[560px]"} transition-all duration-300 overflow-hidden`}>
          <Suspense
            fallback={
              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                <div className="text-center text-slate-400">Rendering 3D site preview...</div>
              </div>
            }
          >
            <Plant3DView assets={filteredAssets} />
          </Suspense>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-black/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-slate-700">
            <div className="text-center">
              <div className="text-slate-400 text-xs uppercase tracking-wider">Asset Assurance Baseline</div>
              <div className="text-white text-xl font-semibold mt-1">
                {analysis.site.siteName} · {filteredAssets.length.toLocaleString()} shown / {analysis.dataset.totalAssets.toLocaleString()} total assets
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={() => setMapCollapsed((v) => !v)}
            className="bg-black/80 backdrop-blur-sm text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs hover:bg-black/90"
          >
            {mapCollapsed ? "Expand Map" : "Collapse Map"}
          </button>
        </div>

        <div className="absolute bottom-6 left-6 z-20">
          <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-slate-700 p-5 w-80 relative">
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">What You Have Right Now</div>
            <div className="flex items-end gap-3 mb-4">
              <div className="text-5xl font-bold text-cyan-300">
                {totalAssets.toLocaleString()}
              </div>
              <div className="text-sm font-medium px-2 py-1 rounded mb-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {analysis.coverageBaseline.discoveryCoveragePercent}% seen in sources
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Evidence-backed: {evidenceBackedCount.toLocaleString()} · Model completeness: {completeness?.overallScore ?? 0}%
              </div>
              <button
                onClick={() => setGapsOpen((v) => !v)}
                className="text-xs px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              >
                {criticalGaps} critical actions
              </button>
            </div>

            {gapsOpen && (
              <div className="absolute left-0 right-0 mt-3 bg-slate-950 border border-slate-700 rounded-lg p-3 z-30">
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Top Critical Actions</div>
                {topCriticalGaps.length === 0 ? (
                  <div className="text-xs text-slate-500">No critical gaps in this run.</div>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-auto">
                    {topCriticalGaps.map((gap, i) => (
                      <li key={`${gap.category}-${i}`} className="text-xs text-slate-200">
                        <span className="text-red-300 font-medium">L{gap.layer}:</span> {gap.category}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-6 right-6 z-20">
          <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-slate-700 p-5">
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Identified Plant Type</div>
            <div className="text-white text-lg font-semibold">
              {PLANT_TYPE_LABELS[completeness?.inferredPlantType ?? "unknown"]}
            </div>
            <div className="text-slate-400 text-sm mt-1">{completeness?.plantTypeConfidence ?? 0}% confidence</div>
            <button
              onClick={startAnalysis}
              disabled={loading}
              className="mt-3 text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 text-slate-200"
            >
              {loading ? "Refreshing..." : "Re-run Analysis"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {canSaveAndExport ? (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
              Signed in · {access.plan.toUpperCase()} plan
            </span>
          ) : (
            <Link
              href="/auth"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20"
            >
              Sign in to save runs, export data, and keep history
            </Link>
          )}
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-white">Infrastructure Reality Gap</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-3">
            <div className="rounded-md border border-slate-700 bg-slate-950/60 p-3">
              Expected assets: <span className="text-slate-100">{expectedAssets.toLocaleString()}</span>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-950/60 p-3">
              Observed assets: <span className="text-slate-100">{totalAssets.toLocaleString()}</span>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-950/60 p-3">
              Reality gap: <span className="text-amber-300">{realityGapAssets.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Formula: |observed assets - expected assets|. This highlights documentation and instrumentation drift.
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <div className="text-xs uppercase tracking-wide text-cyan-200">Facility Reality Gap</div>
          <div className="mt-1 text-sm text-slate-100">
            Difference between documented infrastructure and operational reality. Mission Map closes this gap in measurable steps.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Asset Evidence Quality"
            value={`${analysis.coverageBaseline.evidencedPercent}%`}
            sub={`${evidenceBackedCount.toLocaleString()} / ${totalAssets.toLocaleString()} assets corroborated`}
            help="Backed by stronger evidence quality signals (verified fields and corroboration), not just presence in one source."
            formula="evidence-backed assets / total assets"
            owner="Engineering + OT Data Steward"
            source="Discovery exports + engineering context"
          />
          <MetricCard
            label="Assets Found In Sources"
            value={`${analysis.coverageBaseline.discoveryCoveragePercent}%`}
            sub={`${discoveredCount.toLocaleString()} / ${totalAssets.toLocaleString()} assets seen in at least one source`}
            help="Presence metric only: an asset is counted once discovered in any approved source feed."
            formula="assets seen in >=1 source / total assets"
            owner="OT Operations"
            source="Connected source bundle"
          />
          <MetricCard
            label="Assets With Security Baseline"
            value={`${analysis.coverageBaseline.coveragePercent}%`}
            sub="Securable assets covered"
            help="Coverage over securable assets only (typically Layer 2+)."
            formula="covered securable assets / securable assets"
            owner="Security Operations"
            source="Security baseline signals + telemetry"
          />
          <MetricCard
            label="Assets Missing Security Baseline"
            value={analysis.coverageBaseline.uncoveredAssets.toLocaleString()}
            sub="Securable assets without baseline"
            warning
            help="Gap count can remain high even at 100% discovery because discovery ≠ complete engineering/security baseline."
            formula="securable assets - covered securable assets"
            owner="Security + Reliability"
            source="Coverage gap computation"
          />
        </div>

        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="text-sm font-semibold text-white">Metric Definitions (Operational)</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 text-xs text-slate-300">
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
              <div className="text-cyan-300 font-medium">Question 1: How many assets do we have?</div>
              <div className="mt-1">Use <span className="text-slate-100">Total Assets Discovered</span> and <span className="text-slate-100">Assets Found In Sources</span>.</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
              <div className="text-cyan-300 font-medium">Question 2: What are we clearly missing?</div>
              <div className="mt-1">Use <span className="text-slate-100">Immediate Missing Items</span> and <span className="text-slate-100">Data Requests By Unit/Layer</span>.</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
              <div className="text-cyan-300 font-medium">Question 3: How do we know?</div>
              <div className="mt-1">Use <span className="text-slate-100">Asset Evidence Quality</span> and per-asset source provenance in the unified list.</div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
              <div className="text-cyan-300 font-medium">Question 4: What data do we need next?</div>
              <div className="mt-1">Use missing-element rows and unit-layer requests as the immediate collection plan.</div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href="#asset-list"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400/60"
          >
            Jump to Asset List
          </a>
          <Link
            href="/explorer"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400/60"
          >
            Open Knowledge Graph
          </Link>
          {canSaveAndExport ? (
            <button
              type="button"
              onClick={() => {
                const csv = [
                  ["tag", "name", "layer", "type", "area"].join(","),
                  ...filteredAssets.map((asset) =>
                    [
                      asset.tagNumber || asset.id || "",
                      asset.name || "",
                      asset.layer ? `L${asset.layer}` : "",
                      asset.assetType || "",
                      asset.engineering?.processArea || "",
                    ]
                      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                      .join(",")
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${analysis.site.siteSlug}-assets.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20"
            >
              Export Asset CSV
            </button>
          ) : (
            <Link
              href="/auth"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:border-cyan-400/60"
            >
              Sign in to export
            </Link>
          )}
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_auto_auto]">
            <label className="text-xs text-slate-400">
              Search Assets
              <input
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Tag, name, type, or area"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <div className="text-xs text-slate-400">
              Network Filter
              <div className="mt-1 flex gap-2">
                {[
                  ["all", "All"],
                  ["networked", "Networked"],
                  ["non_networked", "Non-Networked"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNetworkFilter(value as "all" | "networked" | "non_networked")}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      networkFilter === value
                        ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-950 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-400 flex items-end">
              <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200">
                {filteredAssets.length.toLocaleString()} assets in current view
              </div>
            </div>
          </div>
        </div>

        <div id="asset-list" className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Unified Asset List (Primary Workspace)</h3>
            <div className="text-xs text-slate-400">Showing first 80 of {filteredAssets.length.toLocaleString()} filtered assets</div>
          </div>
          <div className="overflow-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Layer</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Area</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.slice(0, 80).map((asset) => (
                  <tr key={asset.id} className="border-t border-slate-800 text-slate-200">
                    <td className="px-3 py-2 font-mono">{asset.tagNumber || asset.id}</td>
                    <td className="px-3 py-2">{asset.name || "Unknown"}</td>
                    <td className="px-3 py-2">{asset.layer ? `L${asset.layer}` : "-"}</td>
                    <td className="px-3 py-2">{asset.assetType?.replace(/_/g, " ") || "-"}</td>
                    <td className="px-3 py-2">{asset.engineering?.processArea || "-"}</td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr className="border-t border-slate-800 text-slate-400">
                    <td colSpan={5} className="px-3 py-3">No assets match current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold text-white">Run History</h3>
          {!canSaveAndExport ? (
            <p className="mt-2 text-xs text-slate-400">
              Sign in to retain run history across sessions and compare site baselines over time.
            </p>
          ) : (
            <RunHistory />
          )}
        </div>

        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold text-white">Immediate Missing Items (Plant Cannot Reliably Run Without)</h3>
          <p className="mt-1 text-xs text-slate-400">
            These are model-detected critical gaps from engineering + OT evidence rules.
          </p>
          <div className="mt-4 overflow-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="px-3 py-2">Layer</th>
                  <th className="px-3 py-2">Missing Element</th>
                  <th className="px-3 py-2">Why It Matters</th>
                  <th className="px-3 py-2">Data Needed</th>
                </tr>
              </thead>
              <tbody>
                {topCriticalGaps.slice(0, 20).map((gap, i) => (
                  <tr key={`${gap.category}-${i}`} className="border-t border-slate-800 text-slate-200">
                    <td className="px-3 py-2">{`L${gap.layer}`}</td>
                    <td className="px-3 py-2">{gap.category}</td>
                    <td className="px-3 py-2">{gap.description}</td>
                    <td className="px-3 py-2">{gap.suggestion || "Collect engineering and OT evidence for this item."}</td>
                  </tr>
                ))}
                {topCriticalGaps.length === 0 && (
                  <tr className="border-t border-slate-800 text-slate-400">
                    <td colSpan={4} className="px-3 py-3">No critical missing items in this run.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold text-white">Evidence-Driven Requests By Unit/Layer</h3>
          <p className="mt-1 text-xs text-slate-400">
            Share this list with engineering and operations to fill high-value data gaps quickly.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {completeness?.layerScores.map((layer) => {
              const criticalLayerGaps = layer.gaps.filter((gap) => gap.severity === "critical");
              if (criticalLayerGaps.length === 0) return null;
              return (
                <div key={layer.layer} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-cyan-300 text-sm font-medium">{`L${layer.layer} · ${layer.name}`}</div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {criticalLayerGaps.slice(0, 4).map((gap, idx) => (
                      <li key={`${gap.category}-${idx}`}>• {gap.suggestion}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  warning,
  help,
  formula,
  owner,
  source,
}: {
  label: string;
  value: string | number;
  sub: string;
  warning?: boolean;
  help?: string;
  formula?: string;
  owner?: string;
  source?: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="mb-2 flex items-center gap-2 text-slate-400 text-sm">
        <span>{label}</span>
        {help && (
          <span
            title={help}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-400"
          >
            i
          </span>
        )}
      </div>
      <div className={`text-3xl font-bold ${warning ? "text-yellow-400" : "text-white"}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
      {(formula || owner || source) && (
        <div className="mt-2 space-y-1 text-[11px] text-slate-400">
          {formula && <div>Formula: <span className="text-slate-300">{formula}</span></div>}
          {owner && <div>Owner: <span className="text-slate-300">{owner}</span></div>}
          {source && <div>Source: <span className="text-slate-300">{source}</span></div>}
        </div>
      )}
    </div>
  );
}

function AgentStep({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: "done" | "active" | "pending";
}) {
  const tone =
    state === "done"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : state === "active"
      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
      : "border-slate-700 bg-slate-950 text-slate-400";

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      <span className="mr-2 text-xs uppercase tracking-wide">{index}</span>
      {label}
    </div>
  );
}

function RunHistory() {
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("planttrace:run_history");
      if (!raw) {
        setHistory([]);
        return;
      }
      const parsed = JSON.parse(raw) as RunHistoryEntry[];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, []);

  if (history.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        No saved runs yet. Complete a baseline run to start building history.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-auto rounded-lg border border-slate-800">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-950 text-slate-300">
          <tr>
            <th className="px-3 py-2">Site</th>
            <th className="px-3 py-2">Profile</th>
            <th className="px-3 py-2">Assets</th>
            <th className="px-3 py-2">Generated</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry, idx) => (
            <tr key={`${entry.siteSlug}-${entry.generatedAt}-${idx}`} className="border-t border-slate-800 text-slate-200">
              <td className="px-3 py-2">{entry.siteName}</td>
              <td className="px-3 py-2">{entry.profile.replace(/_/g, " ")}</td>
              <td className="px-3 py-2">{entry.assets.toLocaleString()}</td>
              <td className="px-3 py-2">
                {new Date(entry.generatedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
