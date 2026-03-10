"use client";

import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import ProcessMap from "@/components/canon/ProcessMap";
import RelationshipGraph from "@/components/canon/RelationshipGraph";
import PlantReconstructionPanel from "@/components/canon/PlantReconstruction";
import { LAYER_NAMES, type CanonAsset, type CanonLayer } from "@/types/canon";
import type { CompletenessResult, GapAnalysis, PlantType } from "@/lib/inventory-completeness";

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

type ViewMode = "process" | "graph";
type SiteProfile = "petrochemical" | "chemical" | "water" | "power";

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

function normalizeProfile(input: string | null): SiteProfile {
  if (!input) return "petrochemical";
  if (input === "petrochemical" || input === "chemical" || input === "water" || input === "power") {
    return input;
  }
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

  const [siteName, setSiteName] = useState("Houston Plant");
  const [siteSlug, setSiteSlug] = useState("houston-plant");
  const [profile, setProfile] = useState<SiteProfile>("petrochemical");
  const [targetAssetCount, setTargetAssetCount] = useState(2400);

  const [showNetworkOverlay, setShowNetworkOverlay] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Partial<CanonAsset> | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>("process");
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
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
            <Plant3DView assets={analysis.assets} />
          </Suspense>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-black/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-slate-700">
            <div className="text-center">
              <div className="text-slate-400 text-xs uppercase tracking-wider">Asset Assurance Baseline</div>
              <div className="text-white text-xl font-semibold mt-1">
                {analysis.site.siteName} · {analysis.dataset.totalAssets.toLocaleString()} assets generated
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
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Reconstruction Confidence</div>
            <div className="flex items-end gap-3 mb-4">
              <div className={`text-5xl font-bold ${
                completeness?.canRunPlant ? "text-green-400" : (completeness?.overallScore ?? 0) >= 60 ? "text-yellow-400" : "text-red-400"
              }`}>
                {completeness?.overallScore ?? 0}%
              </div>
              <div className={`text-sm font-medium px-2 py-1 rounded mb-1 ${
                completeness?.canRunPlant
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}>
                {completeness?.canRunPlant ? "Runnable" : "Incomplete"}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Visualization sample: {analysis.dataset.visualizationAssets} assets
              </div>
              <button
                onClick={() => setGapsOpen((v) => !v)}
                className="text-xs px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              >
                {criticalGaps} critical gaps
              </button>
            </div>

            {gapsOpen && (
              <div className="absolute left-0 right-0 mt-3 bg-slate-950 border border-slate-700 rounded-lg p-3 z-30">
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Critical Gaps</div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Evidence-backed Assets" value={`${analysis.coverageBaseline.evidencedPercent}%`} sub="Verified by source evidence" />
          <MetricCard label="Discovery Coverage" value={`${analysis.coverageBaseline.discoveryCoveragePercent}%`} sub="Present in discovery feeds" />
          <MetricCard label="Security Coverage" value={`${analysis.coverageBaseline.coveragePercent}%`} sub="Securable assets covered" />
          <MetricCard label="Coverage Gaps" value={analysis.coverageBaseline.uncoveredAssets.toLocaleString()} sub="Securable assets without baseline" warning />
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Layer Completeness</h3>
            <div className="text-sm text-slate-400">{totalGaps} gaps · {criticalGaps} critical</div>
          </div>
          <div className="space-y-4">
            {completeness?.layerScores.map((layer) => (
              <div key={layer.layer} className="flex items-center gap-4">
                <div className="w-44 text-sm text-slate-400">L{layer.layer}: {layer.name}</div>
                <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-4 rounded-full ${
                      layer.status === "complete" ? "bg-green-500" : layer.status === "partial" ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${layer.score}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm text-white">{layer.score}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setActiveView("process")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView === "process" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
          >
            Process Map
          </button>
          <button
            onClick={() => setActiveView("graph")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView === "graph" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
          >
            Relationships
          </button>

          {activeView === "process" && (
            <label className="flex items-center gap-2 text-sm text-slate-400 ml-auto">
              <input
                type="checkbox"
                checked={showNetworkOverlay}
                onChange={(e) => setShowNetworkOverlay(e.target.checked)}
                className="rounded bg-slate-700 border-slate-600"
              />
              Show Network Overlay
            </label>
          )}
        </div>

        <div className="mb-8">
          {activeView === "process" && (
            <ProcessMap assets={analysis.assets} onAssetClick={setSelectedAsset} showNetworkOverlay={showNetworkOverlay} />
          )}
          {activeView === "graph" && (
            <RelationshipGraph assets={analysis.assets} selectedAssetId={selectedAsset?.id} onAssetSelect={setSelectedAsset} />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top Baseline Recommendations</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              {(completeness?.recommendations ?? []).slice(0, 8).map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Coverage Blind Spots</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              {(gaps?.networkBlindSpots ?? []).slice(0, 6).map((spot, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  {spot.description}
                </li>
              ))}
              {(gaps?.networkBlindSpots.length ?? 0) === 0 && (
                <li className="text-slate-500">No blind spots detected in sampled baseline.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mb-8">
          <PlantReconstructionPanel />
        </div>

        <div className="p-6 bg-gradient-to-r from-slate-900 to-blue-900/30 rounded-xl border border-slate-800">
          <h3 className="font-semibold text-white text-lg mb-2">Operating Sequence</h3>
          <p className="text-slate-400 text-sm">
            Phase 1: Rebuild physical + OT inventory. Phase 2: verify evidence quality. Phase 3: verify baseline security coverage.
            Phase 4 (later): layer risk, consequence, and production impact.
          </p>
        </div>
      </div>

      {selectedAsset && (
        <div className="fixed bottom-4 right-4 w-80 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 p-4 z-50">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-mono font-bold text-white">{selectedAsset.tagNumber}</div>
              <div className="text-sm text-slate-400">{selectedAsset.name}</div>
            </div>
            <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-white text-xl">×</button>
          </div>
          <div className="mt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Layer</span>
              <span className="text-white">L{selectedAsset.layer}: {LAYER_NAMES[selectedAsset.layer as CanonLayer]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="text-white">{selectedAsset.assetType?.replace(/_/g, " ")}</span>
            </div>
            {selectedAsset.network?.ipAddress && (
              <div className="flex justify-between">
                <span className="text-slate-500">IP</span>
                <span className="font-mono text-white">{selectedAsset.network.ipAddress}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, warning }: { label: string; value: string | number; sub: string; warning?: boolean }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="text-slate-400 text-sm mb-2">{label}</div>
      <div className={`text-3xl font-bold ${warning ? "text-yellow-400" : "text-white"}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}
