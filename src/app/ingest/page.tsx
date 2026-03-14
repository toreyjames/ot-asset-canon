"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
type DataBoundaryMode = "customer_agent" | "customer_cloud" | "hosted_pilot";
type DemoPackOption =
  | "single_plant_baseline"
  | "multi_plant_portfolio"
  | "multi_tenant_operator"
  | "cross_domain_showcase";

interface IngestionResult {
  jobId: string;
  status: string;
  assetsCreated: number;
  assetsUpdated: number;
  errors: string[];
  storageMode?: "metadata_only" | "hosted_raw_pilot";
  dataBoundaryMode?: DataBoundaryMode;
  orgSlug?: string | null;
}

interface DataBoundaryPolicy {
  orgSlug: string | null;
  mode: DataBoundaryMode;
  rawStorage: "customer_environment_only" | "hosted_raw_pilot" | "metadata_only";
  intakeStorage: "customer_environment_only" | "hosted_intake_pilot" | "metadata_only";
  hostedRawUploadsEnabled: boolean;
  hostedIntakeStorageEnabled: boolean;
  source: "default" | "org_setting";
}

interface HybridDemoResponse {
  pack: DemoPackOption;
  sites: {
    siteName: string;
    siteSlug: string;
    profile: string;
    tenantId?: string;
    assets: {
      id?: string;
      tagNumber?: string;
      name?: string;
      assetType?: string;
      engineering?: { processArea?: string };
      controlSystem?: { controllerMake?: string };
    }[];
    stats: {
      totalAssets: number;
      realBenchmarkFields: number;
      syntheticFields: number;
      inferredFields: number;
    };
  }[];
}

interface ActionLogEntry {
  at: string;
  action: string;
  status: "info" | "success" | "error";
  details?: string;
}

const ACTION_LOG_KEY = "baseload:ingest_action_log";

const PACK_DEFAULTS: Record<
  DemoPackOption,
  { scope: OperatingScope; sources: IngestionSource[] }
> = {
  single_plant_baseline: {
    scope: "single_plant",
    sources: ["claroty", "manual", "qualys"],
  },
  multi_plant_portfolio: {
    scope: "company_portfolio",
    sources: ["claroty", "nozomi", "manual", "qualys"],
  },
  multi_tenant_operator: {
    scope: "multi_tenant",
    sources: ["claroty", "manual", "tenable"],
  },
  cross_domain_showcase: {
    scope: "company_portfolio",
    sources: ["claroty", "dragos", "manual", "qualys"],
  },
};

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
  const router = useRouter();
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
  const [demoPack, setDemoPack] = useState<DemoPackOption>("cross_domain_showcase");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoResult, setDemoResult] = useState<HybridDemoResponse | null>(null);
  const [demoNextStep, setDemoNextStep] = useState<string | null>(null);
  const [demoRunLoading, setDemoRunLoading] = useState(false);
  const [demoRunMessage, setDemoRunMessage] = useState<string | null>(null);
  const [virtualDemoFileName, setVirtualDemoFileName] = useState<string | null>(null);
  const [autoDemoTriggered, setAutoDemoTriggered] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [allowDemoTools, setAllowDemoTools] = useState(false);
  const [orgSlug, setOrgSlug] = useState("tmna");
  const [boundaryMode, setBoundaryMode] = useState<DataBoundaryMode>("customer_agent");
  const [boundaryPolicy, setBoundaryPolicy] = useState<DataBoundaryPolicy | null>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundarySaving, setBoundarySaving] = useState(false);
  const [boundaryMessage, setBoundaryMessage] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3 | 4>(1);
  const [stepGateError, setStepGateError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  const pushAction = (action: string, status: ActionLogEntry["status"] = "info", details?: string) => {
    const entry: ActionLogEntry = { at: new Date().toISOString(), action, status, details };
    setActionLog((prev) => {
      const next = [entry, ...prev].slice(0, 200);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(ACTION_LOG_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev < AGENT_STEPS.length - 1 ? prev + 1 : prev));
    }, 900);
    return () => clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(ACTION_LOG_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ActionLogEntry[];
      if (Array.isArray(parsed)) setActionLog(parsed);
    } catch {
      // ignore parse issues for action log hydration
    }
  }, []);

  const sources: { value: IngestionSource; label: string; description: string }[] = [
    { value: "claroty", label: "Claroty", description: "OT discovery export" },
    { value: "dragos", label: "Dragos", description: "Platform asset export" },
    { value: "nozomi", label: "Nozomi", description: "Guardian/Vantage export" },
    { value: "nessus", label: "Nessus", description: "Scanner output" },
    { value: "qualys", label: "Qualys", description: "Scanner output" },
    { value: "tenable", label: "Tenable", description: "Scanner output" },
    {
      value: "manual",
      label: "Engineering / Facility File",
      description: "Equipment list, PLC tags, zones, coordinates, or P&ID index (CSV/JSON)",
    },
  ];

  const estimatedHoursSaved = useMemo(() => {
    if (!result) return 0;
    const processed = result.assetsCreated + result.assetsUpdated;
    return Math.round(processed / 55);
  }, [result]);

  const inventoryContinueHref = "/inventory?from=ingest";

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
  const mapFormationStage = result ? 4 : isLoading ? Math.max(3, setupStep) : setupStep;
  const mapStages = [
    { id: 1, label: "Org Boundary" },
    { id: 2, label: "Deployment Model" },
    { id: 3, label: "Source Graph" },
    { id: 4, label: "Canonical Map" },
  ] as const;

  const validateStep = (step: 1 | 2 | 3 | 4): string | null => {
    if (step === 1) {
      const normalized = orgSlug.trim().toLowerCase();
      if (!normalized) return "Organization slug is required.";
      if (!boundaryPolicy) return "Data boundary must be loaded/saved before continuing.";
      if ((boundaryPolicy.orgSlug || "").toLowerCase() !== normalized) return "Data boundary org must match the current org slug.";
      if (boundaryPolicy.mode !== boundaryMode) return "Boundary mode changed. Save Data Boundary before continuing.";
      return null;
    }

    if (step === 2) {
      if (!deploymentMode || !operatingScope) return "Deployment mode and operating scope must be selected.";
      return null;
    }

    if (step === 3) {
      if (sourceBundle.length === 0) return "Select at least one source in Source Bundle.";
      if (!sourceBundle.includes(uploadSource)) return "Upload source must be one of the selected bundle sources.";
      return null;
    }

    if (step === 4) {
      if (!file) return "A data file is required.";
      return null;
    }

    return null;
  };

  const goToStep = (target: 1 | 2 | 3 | 4) => {
    if (target <= setupStep) {
      setSetupStep(target);
      setStepGateError(null);
      pushAction("Navigate step", "info", `Moved to step ${target}`);
      return;
    }

    const gateError = validateStep(setupStep);
    if (gateError) {
      setStepGateError(gateError);
      pushAction("Step gate blocked", "error", `Step ${setupStep} -> ${target}: ${gateError}`);
      return;
    }

    setStepGateError(null);
    setSetupStep(target);
    pushAction("Step gate passed", "success", `Step ${setupStep} -> ${target}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stepFourError = validateStep(4);
    if (stepFourError) {
      setStepGateError(stepFourError);
      pushAction("Run blocked", "error", stepFourError);
      return;
    }
    setStepGateError(null);
    if (sourceBundle.length === 0) {
      setSourceBundle([uploadSource || "manual"]);
    }
    if (!file) return;
    const selectedFile = file;
    if (!selectedFile) return;

    setIsLoading(true);
    pushAction("Run started", "info", `Source=${uploadSource} Org=${orgSlug.trim().toLowerCase()}`);
    setStepIndex(0);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("source", uploadSource);
      formData.append("orgSlug", orgSlug.trim().toLowerCase());

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ingestion failed");

      setResult(data);
      setStepIndex(AGENT_STEPS.length - 1);
      pushAction(
        "Run completed",
        "success",
        `Created=${data.assetsCreated ?? 0} Updated=${data.assetsUpdated ?? 0}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      pushAction("Run failed", "error", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadBoundaryPolicy = async (targetOrgSlug: string) => {
    const normalized = targetOrgSlug.trim().toLowerCase();
    if (!normalized) return;
    setBoundaryLoading(true);
    setBoundaryMessage(null);
    pushAction("Boundary policy load", "info", normalized);
    try {
      const response = await fetch(
        `/api/assessment/data-boundary?org=${encodeURIComponent(normalized)}`
      );
      const data = await response.json();
      if (!response.ok || !data?.policy) throw new Error(data.error || "Failed to load");
      setBoundaryPolicy(data.policy);
      setBoundaryMode(data.policy.mode);
      pushAction("Boundary policy loaded", "success", `${data.policy.orgSlug || "n/a"} · ${data.policy.mode}`);
    } catch (err) {
      setBoundaryMessage(err instanceof Error ? err.message : "Unable to load policy");
      pushAction("Boundary policy load failed", "error", err instanceof Error ? err.message : "Unable to load policy");
    } finally {
      setBoundaryLoading(false);
    }
  };

  const saveBoundaryPolicy = async () => {
    const normalized = orgSlug.trim().toLowerCase();
    if (!normalized) return;
    setBoundarySaving(true);
    setBoundaryMessage(null);
    pushAction("Boundary policy save", "info", `${normalized} · ${boundaryMode}`);
    try {
      const response = await fetch("/api/assessment/data-boundary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug: normalized, mode: boundaryMode }),
      });
      const data = await response.json();
      if (!response.ok || !data?.policy) throw new Error(data.error || "Failed to save");
      setBoundaryPolicy(data.policy);
      setBoundaryMessage("Data boundary saved.");
      pushAction("Boundary policy saved", "success", `${data.policy.orgSlug || "n/a"} · ${data.policy.mode}`);
    } catch (err) {
      setBoundaryMessage(err instanceof Error ? err.message : "Unable to save policy");
      pushAction("Boundary policy save failed", "error", err instanceof Error ? err.message : "Unable to save policy");
    } finally {
      setBoundarySaving(false);
    }
  };

  const runDemoPack = async (autoStart = false) => {
    setDemoLoading(true);
    setDemoError(null);
    setDemoResult(null);
    setDemoNextStep(null);
    setDemoRunMessage(null);

    try {
      const response = await fetch("/api/demo/hybrid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack: demoPack,
          maxAssetsPerSite: 1200,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate demo pack");
      setDemoResult(data);
      setVirtualDemoFileName(
        `${data.pack}-${new Date().toISOString().slice(0, 10)}.json`
      );

      const defaults = PACK_DEFAULTS[demoPack];
      setOperatingScope(defaults.scope);
      setSourceBundle(defaults.sources);
      setUploadSource(defaults.sources[0]);
      setDemoNextStep(
        "Demo loaded. Next: upload your OT discovery export first, then upload Engineering / Facility File to improve model quality."
      );

      if (autoStart) {
        await startWithDemoPack(data);
      }
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDemoLoading(false);
    }
  };

  const startWithDemoPack = async (overrideDemoResult?: HybridDemoResponse) => {
    const activeDemo = overrideDemoResult || demoResult;
    if (!activeDemo?.sites?.length) {
      setError("Generate a demo pack first, then start the data gathering agent.");
      return;
    }
    setDemoRunLoading(true);
    setIsLoading(true);
    setStepIndex(0);
    setResult(null);
    setDemoRunMessage(null);
    setError(null);

    try {
      const site = activeDemo.sites[0];
      setDemoRunMessage(`Running pipeline from demo pack (${site.siteName})...`);
      const records = site.assets.slice(0, 1200).map((asset, index) => ({
        id: asset.tagNumber || asset.id || `demo-${index + 1}`,
        name: asset.name || `Asset-${index + 1}`,
        vendor: asset.controlSystem?.controllerMake || "Mixed",
        zone: asset.engineering?.processArea || "Unknown",
        type: asset.assetType || "asset",
      }));
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "planttrace:lastIngestRun",
          JSON.stringify({
            source: "demo_pack",
            siteName: site.siteName,
            siteSlug: site.siteSlug,
            profile: site.profile,
            records,
            capturedAt: new Date().toISOString(),
          })
        );
      }

      const response = await fetch("/api/collector/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "file_upload",
          source: "demo_pack",
          facilityName: site.siteName,
          scopeId: site.siteSlug,
          records,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to start from demo pack");

      setResult({
        jobId: data.metadata?.jobId || "demo-pack",
        status: data.metadata?.status || "completed",
        assetsCreated: data.summary?.canonicalAssets || 0,
        assetsUpdated: 0,
        errors: data.metadata?.errors || [],
      });
      setDemoRunMessage(
        `Started from demo pack (${site.siteName}). Canonical assets: ${data.summary?.canonicalAssets ?? 0}.`
      );
      setStepIndex(AGENT_STEPS.length - 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDemoRunMessage(msg);
      setError(msg);
    } finally {
      setIsLoading(false);
      setDemoRunLoading(false);
    }
  };

  useEffect(() => {
    if (autoDemoTriggered) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") !== "1") return;
    setDemoMode(true);
    setAutoDemoTriggered(true);
    void runDemoPack(true);
  }, [autoDemoTriggered]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setDemoMode(params.get("demo") === "1");
    setAllowDemoTools(params.get("demoTools") === "1");
  }, []);

  useEffect(() => {
    if (!demoMode || !result || isLoading || demoRunLoading) return;
    const timer = setTimeout(() => {
      router.push(inventoryContinueHref);
    }, 1200);
    return () => clearTimeout(timer);
  }, [demoMode, result, isLoading, demoRunLoading, router]);

  useEffect(() => {
    const normalized = orgSlug.trim().toLowerCase();
    if (!normalized) return;
    const timer = setTimeout(() => {
      void loadBoundaryPolicy(normalized);
    }, 250);
    return () => clearTimeout(timer);
  }, [orgSlug]);

  if (demoMode) {
    return (
      <div className="min-h-screen bg-[#050915] text-slate-100 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 md:p-8">
            <div className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              Guided Demo Run
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white">Running Mission Map Demo</h1>
            <p className="mt-2 text-slate-300">
              This flow is automatic. We generate demo records, run the data gathering pipeline, then open Inventory.
            </p>

            <div className="mt-6 space-y-2">
              {AGENT_STEPS.map((step, idx) => {
                const state = result
                  ? "done"
                  : isLoading || demoLoading || demoRunLoading
                  ? idx < stepIndex
                    ? "done"
                    : idx === stepIndex
                    ? "active"
                    : "pending"
                  : "pending";
                return <AgentStep key={step} index={idx + 1} label={step} state={state} />;
              })}
            </div>

            <div className="mt-5 rounded-md border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-200">
              {demoLoading || demoRunLoading || isLoading
                ? "Demo is running..."
                : result
                ? `Run complete. ${result.assetsCreated.toLocaleString()} canonical assets created. Redirecting to Inventory...`
                : "Preparing demo run..."}
            </div>

            {demoRunMessage && (
              <div className="mt-3 text-sm text-slate-300">{demoRunMessage}</div>
            )}

            {(error || demoError) && (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error || demoError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void runDemoPack(true);
                }}
                disabled={demoLoading || demoRunLoading || isLoading}
                className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
              >
                {demoLoading || demoRunLoading || isLoading ? "Running..." : "Run Demo Again"}
              </button>
              <Link
                href="/"
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-cyan-400/60"
              >
                Back Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="industrial-spec min-h-screen bg-[#060606] text-zinc-100">
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <header className="spec-block px-4 py-4 sm:px-6">
          <p className="spec-eyebrow">Mission Map</p>
          <h1 className="spec-title mt-2">Data Gathering Agent</h1>
          <p className="spec-body mt-2 max-w-4xl">
            Upload once. Mission Map handles source ingestion, normalization, identity resolution, and publish.
          </p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-100">
              OT Safety Notice: data-only workflow. No control-system writes.
            </div>
            <div className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-cyan-100">
              1) Org+Boundary 2) Deployment 3) Source Bundle 4) File+Run
            </div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
          <div className="spec-block p-6">
          <h2 className="text-lg font-semibold text-white">Run Configuration</h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="rounded-md border border-slate-700 bg-slate-950/70 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Setup Progress</div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  [1, "Org & Boundary"],
                  [2, "Deployment"],
                  [3, "Source Bundle"],
                  [4, "File & Run"],
                ].map(([idx, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => goToStep(idx as 1 | 2 | 3 | 4)}
                    className={`rounded-md border px-2 py-1 text-[11px] ${
                      setupStep === idx
                        ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-900 text-slate-400"
                    }`}
                  >
                    {idx}. {label}
                  </button>
                ))}
              </div>
            </div>

            {stepGateError && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                Step check: {stepGateError}
              </div>
            )}

            {setupStep === 1 && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-400 mb-2">Assessment Org</div>
                  <input
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                    placeholder="tmna"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Used to persist data-boundary policy for this org.</p>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-2">Data Boundary (Phase 0)</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <ModeCard
                      title="Customer Agent"
                      body="Raw data stays customer-side"
                      active={boundaryMode === "customer_agent"}
                      onClick={() => {
                        setBoundaryMode("customer_agent");
                        pushAction("Boundary mode selected", "info", "customer_agent");
                      }}
                    />
                    <ModeCard
                      title="Customer Cloud"
                      body="Cloud model, metadata-first"
                      active={boundaryMode === "customer_cloud"}
                      onClick={() => {
                        setBoundaryMode("customer_cloud");
                        pushAction("Boundary mode selected", "info", "customer_cloud");
                      }}
                    />
                    <ModeCard
                      title="Hosted Pilot"
                      body="Hosted storage pilot gates"
                      active={boundaryMode === "hosted_pilot"}
                      onClick={() => {
                        setBoundaryMode("hosted_pilot");
                        pushAction("Boundary mode selected", "info", "hosted_pilot");
                      }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveBoundaryPolicy}
                      disabled={boundarySaving || boundaryLoading || !orgSlug.trim()}
                      className="rounded-md border border-cyan-400/60 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                    >
                      {boundarySaving ? "Saving..." : "Save Data Boundary"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadBoundaryPolicy(orgSlug)}
                      disabled={boundarySaving || boundaryLoading || !orgSlug.trim()}
                      className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/60 disabled:opacity-60"
                    >
                      {boundaryLoading ? "Loading..." : "Refresh Policy"}
                    </button>
                  </div>
                  {boundaryMessage && <div className="mt-2 text-xs text-slate-300">{boundaryMessage}</div>}
                </div>

                <div className="rounded-md border border-slate-700 bg-slate-950/70 p-3 text-xs">
                  <div className="text-slate-200">Where Data Lives</div>
                  <div className="mt-2 text-slate-400">
                    Org: <span className="text-slate-200">{boundaryPolicy?.orgSlug || orgSlug || "n/a"}</span>
                  </div>
                  <div className="mt-1 text-slate-400">
                    Mode: <span className="text-slate-200">{boundaryPolicy?.mode || boundaryMode}</span>
                  </div>
                  <div className="mt-1 text-slate-400">
                    Raw upload storage: <span className="text-slate-200">{boundaryPolicy?.rawStorage || "metadata_only"}</span>
                  </div>
                  <div className="mt-1 text-slate-400">
                    Intake storage: <span className="text-slate-200">{boundaryPolicy?.intakeStorage || "metadata_only"}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    disabled={!orgSlug.trim()}
                    className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                  >
                    Next: Deployment
                  </button>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-400 mb-2">Deployment Mode</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <ModeCard
                      title="Customer Cloud"
                      body="Runs in customer tenant"
                      active={deploymentMode === "customer_cloud"}
                      onClick={() => {
                        setDeploymentMode("customer_cloud");
                        pushAction("Deployment mode selected", "info", "customer_cloud");
                      }}
                    />
                    <ModeCard
                      title="Hybrid Connector"
                      body="Plant-side gather + cloud orchestration"
                      active={deploymentMode === "hybrid_connector"}
                      onClick={() => {
                        setDeploymentMode("hybrid_connector");
                        pushAction("Deployment mode selected", "info", "hybrid_connector");
                      }}
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
                      onClick={() => {
                        setOperatingScope("single_plant");
                        pushAction("Operating scope selected", "info", "single_plant");
                      }}
                    />
                    <ModeCard
                      title="Company Portfolio"
                      body="Multi-plant under one owner"
                      active={operatingScope === "company_portfolio"}
                      onClick={() => {
                        setOperatingScope("company_portfolio");
                        pushAction("Operating scope selected", "info", "company_portfolio");
                      }}
                    />
                    <ModeCard
                      title="Multi-Tenant"
                      body="Tenant-separated operations"
                      active={operatingScope === "multi_tenant"}
                      onClick={() => {
                        setOperatingScope("multi_tenant");
                        pushAction("Operating scope selected", "info", "multi_tenant");
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-cyan-400/60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                    Next: Source Bundle
                  </button>
                </div>
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-400 mb-2">Source Bundle (What You Plan To Connect)</div>
                  <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceBundle(["claroty", "manual", "qualys"]);
                      setUploadSource("claroty");
                      pushAction("Source bundle preset", "info", "Suggested Start Bundle");
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
                      pushAction("Source bundle preset", "info", "OT-Only");
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
                              if (!next.includes(uploadSource) && next.length > 0) setUploadSource(next[0]);
                              pushAction(
                                active ? "Source removed" : "Source added",
                                "info",
                                `${s.value} · total=${next.length}`
                              );
                              return next;
                            });
                          }}
                          className={`rounded-md border px-2.5 py-1.5 text-xs ${
                            active ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-slate-950 text-slate-300"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Multi-source is supported. Add expected sources first, then upload one file at a time and tag it correctly.
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
                          onClick={() => {
                            setUploadSource(value);
                            pushAction("Upload source selected", "info", value);
                          }}
                          className={`rounded-md border px-3 py-1.5 text-xs ${
                            uploadSource === value ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-700 bg-slate-950 text-slate-300"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-slate-700 bg-slate-950/70 p-3 text-xs">
                  <div className="text-slate-300">Model Readiness Checklist</div>
                  <div className={hasOtCoverage ? "text-emerald-300 mt-1" : "text-amber-300 mt-1"}>
                    {hasOtCoverage ? "OT discovery source selected" : "OT discovery source missing"}
                  </div>
                  <div className={hasEngineeringCoverage ? "text-emerald-300 mt-1" : "text-amber-300 mt-1"}>
                    {hasEngineeringCoverage ? "Engineering source selected" : "Engineering input missing (tags/P&ID/facility layout expected)"}
                  </div>
                  <div className={hasNetworkCoverage ? "text-emerald-300 mt-1" : "text-amber-300 mt-1"}>
                    {hasNetworkCoverage ? "Network/security source selected" : "Network context missing"}
                  </div>
                  <div className="mt-3 border-t border-slate-700 pt-2 text-slate-300">
                    <div className="text-cyan-200 mb-1">Engineering suggestions for first-pass quality:</div>
                    {suggestedEngineeringInputs.map((item) => (
                      <div key={item}>• {item}</div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-cyan-400/60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(4)}
                    disabled={sourceBundle.length === 0}
                    className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                  >
                    Next: File & Run
                  </button>
                </div>
              </div>
            )}

            {setupStep === 4 && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-400 mb-2">Data File</div>
                  <label className="block rounded-lg border-2 border-dashed border-slate-600 bg-slate-950/70 p-5 text-center cursor-pointer hover:border-cyan-500/60">
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setVirtualDemoFileName(null);
                        const nextFile = e.target.files?.[0];
                        pushAction(
                          nextFile ? "File selected" : "File cleared",
                          "info",
                          nextFile ? `${nextFile.name} (${nextFile.size} bytes)` : undefined
                        );
                      }}
                      className="hidden"
                    />
                    {file ? (
                      <span className="text-sm text-slate-100">{file.name}</span>
                    ) : (
                      <span className="text-sm text-slate-300">Click to upload CSV/JSON</span>
                    )}
                  </label>
                  <p className="mt-2 text-xs text-slate-400">
                    If this file is engineering context, set <span className="text-slate-200">Upload This File As</span> to
                    <span className="text-slate-200"> Engineering / Facility File</span>.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={autonomousRun}
                    onChange={(e) => {
                      setAutonomousRun(e.target.checked);
                      pushAction("Autonomous mode toggled", "info", e.target.checked ? "enabled" : "disabled");
                    }}
                    className="h-4 w-4"
                  />
                  Autonomous pipeline mode (recommended)
                </label>
                <p className="-mt-3 text-xs text-slate-400">
                  Runs parse, normalize, dedupe, confidence scoring, and publish.
                </p>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-cyan-400/60"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!file || isLoading || demoRunLoading}
                    className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                  >
                    {isLoading || demoRunLoading ? "Agent Running..." : "Start Data Gathering Agent"}
                  </button>
                </div>
                {!file && <p className="text-[11px] text-amber-300">Upload a file to run this button.</p>}
                <p className="text-[11px] text-slate-500">Read-only collection only. No process control or logic writes.</p>
              </div>
            )}
          </form>

          {error && <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

            {result && (
              <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <div className="font-semibold">Run Complete · {result.status}</div>
                <div className="mt-1">Created: {result.assetsCreated.toLocaleString()} · Updated: {result.assetsUpdated.toLocaleString()}</div>
                <div className="mt-1">Estimated analyst hours saved this run: ~{estimatedHoursSaved}</div>
                {result.dataBoundaryMode && (
                  <div className="mt-1">
                    Data boundary: {result.dataBoundaryMode}
                    {result.orgSlug ? ` (${result.orgSlug})` : ""}
                    {result.storageMode ? ` · Storage: ${result.storageMode}` : ""}
                  </div>
                )}
                {result.errors.length > 0 && <div className="mt-1 text-amber-200">Errors: {result.errors.length}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={inventoryContinueHref}
                    className="rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Continue to Inventory
                  </Link>
                  <Link
                    href="/explorer"
                    className="rounded-md border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20"
                  >
                    Open Graph Explorer
                  </Link>
                </div>
              </div>
            )}
        </div>

        <div className="spec-block p-6">
          <div className="spec-section-label">Mission Map Formation</div>
          <div className="mt-3 spec-visual-panel">
            <svg viewBox="0 0 520 150" className="h-32 w-full">
              <g fill="none" stroke="currentColor" strokeOpacity="0.75">
                <line x1="70" y1="75" x2="450" y2="75" />
                {[70, 196, 323, 450].map((x, i) => (
                  <g key={x}>
                    <circle
                      cx={x}
                      cy={75}
                      r={mapFormationStage > i ? 16 : 12}
                      fill={mapFormationStage > i ? "rgba(190,242,100,0.28)" : "rgba(161,161,170,0.16)"}
                      stroke={mapFormationStage > i ? "rgba(190,242,100,0.85)" : "rgba(161,161,170,0.65)"}
                    />
                    <text x={x} y={116} textAnchor="middle" fontSize="10" fill="rgba(228,228,231,0.9)">
                      {i + 1}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
            <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
              {mapStages.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between rounded border border-zinc-700 bg-[#090909] px-2 py-1">
                  <span className="text-zinc-300">{stage.label}</span>
                  <span className={mapFormationStage >= stage.id ? "text-emerald-300" : "text-zinc-500"}>
                    {mapFormationStage > stage.id ? "DONE" : mapFormationStage === stage.id ? "ACTIVE" : "PENDING"}
                  </span>
                </div>
              ))}
            </div>
          </div>

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

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-cyan-300">Action Log</div>
              <button
                type="button"
                onClick={() => {
                  setActionLog([]);
                  if (typeof window !== "undefined") {
                    window.sessionStorage.removeItem(ACTION_LOG_KEY);
                  }
                  pushAction("Action log cleared", "info");
                }}
                className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-400/60"
              >
                Clear
              </button>
            </div>
            <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
              {actionLog.length > 0 ? (
                actionLog.slice(0, 30).map((entry, idx) => (
                  <div key={`${entry.at}-${idx}`} className="rounded border border-slate-800 bg-slate-900/70 p-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={
                          entry.status === "error"
                            ? "text-rose-300"
                            : entry.status === "success"
                            ? "text-emerald-300"
                            : "text-slate-200"
                        }
                      >
                        {entry.action}
                      </span>
                      <span className="text-slate-500">{new Date(entry.at).toLocaleTimeString()}</span>
                    </div>
                    {entry.details ? <div className="mt-1 text-slate-400">{entry.details}</div> : null}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500">No actions logged yet.</div>
              )}
            </div>
          </div>

          {allowDemoTools ? (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-300">Demo Pack Runner</div>
            <p className="mt-2 text-sm text-slate-300">
              Run a realistic demo pack directly in the app (no terminal required).
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["cross_domain_showcase", "Cross-Domain"],
                  ["single_plant_baseline", "Single Plant"],
                  ["multi_plant_portfolio", "Portfolio"],
                  ["multi_tenant_operator", "Multi-Tenant"],
                ] as [DemoPackOption, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDemoPack(value)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs ${
                    demoPack === value
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-700 bg-slate-900 text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                void runDemoPack(false);
              }}
              disabled={demoLoading}
              className="mt-3 w-full rounded-md border border-cyan-400/50 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
            >
              {demoLoading ? "Generating Demo Pack..." : "Generate Demo Pack"}
            </button>

            {demoError && (
              <div className="mt-3 text-xs text-red-300">{demoError}</div>
            )}

            {demoResult && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-emerald-300">Generated: {demoResult.pack}</div>
                {demoResult.sites.map((site) => (
                  <div key={site.siteSlug} className="rounded-md border border-slate-700 bg-slate-900 p-2 text-xs">
                    <div className="text-slate-100">{site.siteName}</div>
                    <div className="text-slate-400">
                      {site.profile} · {site.stats.totalAssets.toLocaleString()} assets
                      {site.tenantId ? ` · ${site.tenantId}` : ""}
                    </div>
                  </div>
                ))}
                {demoNextStep && (
                  <div className="rounded-md border border-cyan-500/40 bg-cyan-500/10 p-2 text-xs text-cyan-100">
                    {demoNextStep}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void startWithDemoPack();
                  }}
                  disabled={demoRunLoading}
                  className="w-full rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  {demoRunLoading ? "Starting..." : "Start Data Gathering Agent With Demo Pack"}
                </button>
                {demoRunMessage && (
                  <div className="text-xs text-slate-300">{demoRunMessage}</div>
                )}
              </div>
            )}
            </div>
          ) : null}
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
