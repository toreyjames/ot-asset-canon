"use client";

import { useEffect, useMemo, useState } from "react";

type IngestionSource =
  | "claroty"
  | "dragos"
  | "nozomi"
  | "nessus"
  | "qualys"
  | "tenable"
  | "manual";

type DeploymentMode = "customer_cloud" | "hybrid_connector";
type OperatingScope = "single_plant" | "company_portfolio" | "multi_tenant";

interface IngestionResult {
  jobId: string;
  status: string;
  assetsCreated: number;
  assetsUpdated: number;
  errors: string[];
}

const AGENT_STEPS = [
  "Connect Sources",
  "Ingest Raw Data",
  "Normalize Records",
  "Resolve Asset Identity",
  "Validate Confidence",
  "Publish Canonical Inventory",
];

const OT_SOURCES: IngestionSource[] = ["claroty", "dragos", "nozomi"];
const ENGINEERING_SOURCES: IngestionSource[] = ["manual"];
const NETWORK_SOURCES: IngestionSource[] = ["manual", "nessus", "qualys", "tenable"];

export default function IngestPage() {
  const [uploadSource, setUploadSource] = useState<IngestionSource>("claroty");
  const [sourceBundle, setSourceBundle] = useState<IngestionSource[]>(["claroty"]);
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>("customer_cloud");
  const [operatingScope, setOperatingScope] = useState<OperatingScope>("single_plant");
  const [autonomousRun, setAutonomousRun] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev < AGENT_STEPS.length - 1 ? prev + 1 : prev));
    }, 900);
    return () => clearInterval(timer);
  }, [isLoading]);

  const sources: { value: IngestionSource; label: string; description: string }[] = [
    { value: "claroty", label: "Claroty", description: "OT discovery export" },
    { value: "dragos", label: "Dragos", description: "Platform asset export" },
    { value: "nozomi", label: "Nozomi", description: "Guardian/Vantage export" },
    { value: "nessus", label: "Nessus", description: "Scanner output" },
    { value: "qualys", label: "Qualys", description: "Scanner output" },
    { value: "tenable", label: "Tenable", description: "Scanner output" },
    { value: "manual", label: "Manual", description: "CSV/JSON fallback" },
  ];

  const estimatedHoursSaved = useMemo(() => {
    if (!result) return 0;
    const processed = result.assetsCreated + result.assetsUpdated;
    return Math.round(processed / 55);
  }, [result]);

  const hasOtCoverage = useMemo(
    () => sourceBundle.some((s) => OT_SOURCES.includes(s)),
    [sourceBundle]
  );
  const hasEngineeringCoverage = useMemo(
    () => sourceBundle.some((s) => ENGINEERING_SOURCES.includes(s)),
    [sourceBundle]
  );
  const hasNetworkCoverage = useMemo(
    () => sourceBundle.some((s) => NETWORK_SOURCES.includes(s)),
    [sourceBundle]
  );

  const suggestedEngineeringInputs = [
    "Equipment list (tag, name, vendor, area/zone)",
    "PLC tag export (controller, tag, line/unit)",
    "Facility zone map or coordinates",
    "P&ID or line index reference map",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setStepIndex(0);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", uploadSource);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ingestion failed");

      setResult(data);
      setStepIndex(AGENT_STEPS.length - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
          Product-Led Self Deployment
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100">Data Gathering Agent</h1>
        <p className="mt-2 text-slate-300">
          Upload once. PlantTrace handles source ingestion, normalization, identity resolution, and publish.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-6">
          <h2 className="text-lg font-semibold text-white">Run Configuration</h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div>
              <div className="text-xs text-slate-400 mb-2">Deployment Mode</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ModeCard
                  title="Customer Cloud"
                  body="Runs in customer tenant"
                  active={deploymentMode === "customer_cloud"}
                  onClick={() => setDeploymentMode("customer_cloud")}
                />
                <ModeCard
                  title="Hybrid Connector"
                  body="Plant-side gather + cloud orchestration"
                  active={deploymentMode === "hybrid_connector"}
                  onClick={() => setDeploymentMode("hybrid_connector")}
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-2">Operating Scope</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <ModeCard
                  title="Single Plant"
                  body="One facility baseline"
                  active={operatingScope === "single_plant"}
                  onClick={() => setOperatingScope("single_plant")}
                />
                <ModeCard
                  title="Company Portfolio"
                  body="Multi-plant under one owner"
                  active={operatingScope === "company_portfolio"}
                  onClick={() => setOperatingScope("company_portfolio")}
                />
                <ModeCard
                  title="Multi-Tenant"
                  body="Tenant-separated operations"
                  active={operatingScope === "multi_tenant"}
                  onClick={() => setOperatingScope("multi_tenant")}
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-2">Source Bundle (What You Plan To Connect)</div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSourceBundle(["claroty", "manual", "qualys"]);
                    setUploadSource("claroty");
                  }}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-cyan-400/70"
                >
                  Suggested Start Bundle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceBundle(["claroty"]);
                    setUploadSource("claroty");
                  }}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-cyan-400/70"
                >
                  OT-Only (Not Recommended)
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => {
                  const active = sourceBundle.includes(s.value);
                  return (
                    <button
                      key={`bundle-${s.value}`}
                      type="button"
                      onClick={() => {
                        setSourceBundle((prev) => {
                          const next = active ? prev.filter((x) => x !== s.value) : [...prev, s.value];
                          if (!next.includes(uploadSource) && next.length > 0) {
                            setUploadSource(next[0]);
                          }
                          return next;
                        });
                      }}
                      className={`rounded-md border px-2.5 py-1.5 text-xs ${
                        active
                          ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                          : "border-slate-700 bg-slate-950 text-slate-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Multi-source is supported. Add your expected sources first, then upload one file at a time and tag it correctly.
              </p>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-2">Upload This File As</div>
              <div className="flex flex-wrap gap-2">
                {sourceBundle.length === 0 && <div className="text-xs text-amber-300">Select at least one source in Source Bundle.</div>}
                {sourceBundle.map((value) => {
                  const label = sources.find((s) => s.value === value)?.label || value;
                  return (
                    <button
                      key={`upload-${value}`}
                      type="button"
                      onClick={() => setUploadSource(value)}
                      className={`rounded-md border px-3 py-1.5 text-xs ${
                        uploadSource === value
                          ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                          : "border-slate-700 bg-slate-950 text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-md border border-slate-700 bg-slate-950/70 p-3 text-xs">
                <div className="text-slate-300">Model Readiness Checklist</div>
                <div className={hasOtCoverage ? "text-emerald-300 mt-1" : "text-amber-300 mt-1"}>
                  {hasOtCoverage ? "OT discovery source selected" : "OT discovery source missing"}
                </div>
                <div className={hasEngineeringCoverage ? "text-emerald-300 mt-1" : "text-amber-300 mt-1"}>
                  {hasEngineeringCoverage
                    ? "Engineering source selected"
                    : "Engineering input missing (tags/P&ID/facility layout expected)"}
                </div>
                <div className={hasNetworkCoverage ? "text-emerald-300 mt-1" : "text-amber-300 mt-1"}>
                  {hasNetworkCoverage ? "Network/security source selected" : "Network context missing"}
                </div>
                {!hasEngineeringCoverage && (
                  <div className="mt-3 border-t border-slate-700 pt-2 text-slate-300">
                    <div className="text-amber-300 mb-1">Engineering suggestions for first-pass quality:</div>
                    {suggestedEngineeringInputs.map((item) => (
                      <div key={item}>• {item}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-2">Data File</div>
              <label className="block rounded-lg border-2 border-dashed border-slate-600 bg-slate-950/70 p-5 text-center cursor-pointer hover:border-cyan-500/60">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {file ? (
                  <span className="text-sm text-slate-100">{file.name}</span>
                ) : (
                  <span className="text-sm text-slate-300">Click to upload CSV/JSON</span>
                )}
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={autonomousRun}
                onChange={(e) => setAutonomousRun(e.target.checked)}
                className="h-4 w-4"
              />
              Autonomous run (recommended)
            </label>

            <button
              type="submit"
              disabled={!file || isLoading || sourceBundle.length === 0}
              className="w-full rounded-md bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            >
              {isLoading ? "Agent Running..." : "Start Data Gathering Agent"}
            </button>
          </form>

          {error && <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

          {result && (
            <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="font-semibold">Run Complete · {result.status}</div>
              <div className="mt-1">Created: {result.assetsCreated.toLocaleString()} · Updated: {result.assetsUpdated.toLocaleString()}</div>
              <div className="mt-1">Estimated analyst hours saved this run: ~{estimatedHoursSaved}</div>
              {result.errors.length > 0 && <div className="mt-1 text-amber-200">Errors: {result.errors.length}</div>}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-6">
          <h2 className="text-lg font-semibold text-white">Agent Pipeline</h2>
          <p className="mt-1 text-sm text-slate-400">What the platform executes for a hands-off deployment.</p>

          <div className="mt-4 space-y-2">
            {AGENT_STEPS.map((step, idx) => {
              const state = result
                ? "done"
                : isLoading
                ? idx < stepIndex
                  ? "done"
                  : idx === stepIndex
                  ? "active"
                  : "pending"
                : "pending";

              return <AgentStep key={step} index={idx + 1} label={step} state={state} />;
            })}
          </div>

          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-300">Why This Matters</div>
            <p className="mt-2 text-sm text-slate-300">
              This agent is your product moat: repeatable ingestion, deterministic asset identity, and CMDB-ready outputs
              with less service effort per deployment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  body,
  active,
  onClick,
}: {
  title: string;
  body: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border p-3 text-left transition-colors ${
        active ? "border-cyan-400 bg-cyan-500/15" : "border-slate-700 bg-slate-950 hover:border-slate-500"
      }`}
    >
      <div className="text-sm font-medium text-slate-100">{title}</div>
      <div className="text-xs text-slate-400 mt-1">{body}</div>
    </button>
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
