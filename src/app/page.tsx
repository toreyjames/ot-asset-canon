import { LAYER_NAMES, LAYER_DESCRIPTIONS, type CanonLayer } from "@/types/canon";

export default function Dashboard() {
  const layers: CanonLayer[] = [6, 5, 4, 3, 2, 1];

  const stats = {
    totalAssets: 1247,
    evidencedAssets: 1098,
    coveredAssets: 942,
    uncoveredAssets: 305,
    plantsConnected: 6,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white p-8 md:p-10">
        <PlantMapBackground />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
            Asset Assurance for Critical Infrastructure
          </div>

          <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight">
            You Cannot Secure What You Cannot See
          </h1>

          <p className="mt-4 text-slate-300 text-base md:text-lg max-w-2xl">
            PlantTrace builds an evidence-backed OT asset baseline across plants, verifies baseline security coverage,
            and feeds trusted records into your CMDB.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/inventory"
              className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-sm"
            >
              Run Asset Analysis
            </a>
            <a
              href="/framework"
              className="px-4 py-2 rounded-md border border-slate-600 hover:border-slate-400 text-slate-200 text-sm"
            >
              Read Framework v1
            </a>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-2">
            <HeroMetric label="Assets" value={stats.totalAssets.toLocaleString()} />
            <HeroMetric label="Evidence-backed" value={stats.evidencedAssets.toLocaleString()} />
            <HeroMetric label="Covered" value={stats.coveredAssets.toLocaleString()} />
            <HeroMetric label="Gaps" value={stats.uncoveredAssets.toLocaleString()} />
            <HeroMetric label="Plants" value={stats.plantsConnected.toString()} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ProblemCard
          tone="primary"
          title="Primary Problem"
          headline="No trustworthy OT asset inventory"
          body="Teams cannot reliably answer how many assets exist, where they are, and what should be protected."
        />
        <ProblemCard
          tone="secondary"
          title="Secondary Problem"
          headline="No central view of asset health"
          body="Evidence, telemetry, and coverage are fragmented across plants and point tools."
        />
        <ProblemCard
          tone="secondary"
          title="Long-Term Problem"
          headline="Weak path to system of record"
          body="Without clean inventory provenance, CMDB synchronization and lifecycle governance fail."
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plant Reconstruction Stack</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Rebuild plant understanding from physics and operations upward, then evaluate baseline coverage from that truth.
          </p>
          <div className="canon-stack">
            {layers.map((layer) => (
              <LayerCard key={layer} layer={layer} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Asset Assurance Queries</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Focus on inventory truth, provenance, and coverage baseline.
            </p>
            <div className="space-y-2">
              <QuickQuery query="How many assets are currently in scope for Houston Plant?" />
              <QuickQuery query="Which assets are confirmed by two or more independent sources?" />
              <QuickQuery query="Which assets do not have OT discovery or endpoint/security coverage?" />
              <QuickQuery query="Show assets ready for CMDB sync with high-confidence provenance." />
            </div>
            <a
              href="/ai"
              className="mt-4 inline-block w-full text-center bg-layer5 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Open AI Query Interface
            </a>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Baseline Coverage Snapshot</h2>
            <div className="space-y-3">
              <CoverageBar label="OT Discovery Coverage" value={88} />
              <CoverageBar label="Endpoint Control Coverage (Tanium)" value={71} />
              <CoverageBar label="Visibility Coverage (Qualys)" value={64} />
              <CoverageBar label="Engineering Context Coverage" value={82} />
            </div>
            <a
              href="/sites/houston-plant/coverage"
              className="mt-4 inline-block w-full text-center border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-md text-sm font-medium"
            >
              View Site Coverage
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Public Sector Ready</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Designed to support critical infrastructure operators, including public sector and defense-adjacent environments.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ReadinessItem title="Tenant Isolation" text="Organization and site-level data separation." />
          <ReadinessItem title="RBAC + Auditability" text="Role-based access and full event traceability." />
          <ReadinessItem title="Data Governance" text="Retention controls and CMDB export pathways." />
          <ReadinessItem title="Evidence Provenance" text="Every asset assertion linked to source evidence." />
          <ReadinessItem title="Coverage Baseline" text="Securable assets tracked as covered/uncovered." />
          <ReadinessItem title="Multi-Plant Portfolio" text="Single operating picture across facilities." />
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Problem + Framework</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          We solve one upstream problem first: establish trustworthy asset reality across one plant or many plants.
          The framework is Count, Prove, Cover: count assets, prove each with evidence, and verify baseline controls.
        </p>
        <a
          href="/framework"
          className="mt-5 inline-block px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          Read Framework v1
        </a>
      </section>
    </div>
  );
}

function PlantMapBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute -bottom-28 right-10 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full opacity-45" viewBox="0 0 1200 500" fill="none" aria-hidden>
        <path d="M40 320 L220 320 L220 240 L420 240 L420 300 L620 300 L620 210 L840 210 L840 270 L1140 270" stroke="#67e8f9" strokeWidth="2" strokeDasharray="4 6" />
        <path d="M80 380 L280 380 L280 330 L500 330 L500 390 L760 390 L760 320 L1060 320" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 7" />
        {[
          [220, 320], [420, 240], [620, 300], [840, 210], [280, 380], [500, 330], [760, 390],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="9" fill="#0f172a" stroke="#67e8f9" strokeWidth="2" />
            <circle cx={x} cy={y} r="3" fill="#67e8f9" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-700/80 bg-slate-900/70 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function ProblemCard({
  tone,
  title,
  headline,
  body,
}: {
  tone: "primary" | "secondary";
  title: string;
  headline: string;
  body: string;
}) {
  const toneStyles =
    tone === "primary"
      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";

  const labelTone = tone === "primary" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300";

  return (
    <div className={`rounded-lg border p-4 ${toneStyles}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${labelTone}`}>{title}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{headline}</div>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{body}</p>
    </div>
  );
}

function ReadinessItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{text}</div>
    </div>
  );
}

function LayerCard({ layer }: { layer: CanonLayer }) {
  const layerColors: Record<CanonLayer, string> = {
    1: "layer-1",
    2: "layer-2",
    3: "layer-3",
    4: "layer-4",
    5: "layer-5",
    6: "layer-6",
  };

  const assetCounts: Record<CanonLayer, number> = {
    1: 47,
    2: 312,
    3: 89,
    4: 156,
    5: 423,
    6: 220,
  };

  return (
    <a href={`/explorer?layer=${layer}`} className={`canon-layer ${layerColors[layer]} cursor-pointer`}>
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm opacity-75">Layer {layer}</span>
          <h3 className="font-semibold">{LAYER_NAMES[layer]}</h3>
          <p className="text-sm opacity-75 mt-1">{LAYER_DESCRIPTIONS[layer]}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold">{assetCounts[layer]}</span>
          <p className="text-sm opacity-75">assets</p>
        </div>
      </div>
    </a>
  );
}

function QuickQuery({ query }: { query: string }) {
  return (
    <a
      href={`/ai?q=${encodeURIComponent(query)}`}
      className="block text-sm text-gray-600 dark:text-gray-400 hover:text-layer5 dark:hover:text-blue-400 truncate"
    >
      &quot;{query}&quot;
    </a>
  );
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-800 dark:text-gray-200">{value}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${value >= 80 ? "bg-green-500" : value >= 65 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
