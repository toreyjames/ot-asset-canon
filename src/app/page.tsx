import Link from "next/link";
import PlantTraceLogo from "@/components/marketing/PlantTraceLogo";
import ConversionPanel from "@/components/marketing/ConversionPanel";

const PROBLEMS = [
  {
    title: "Unknown Asset Reality",
    body: "Most plants cannot answer exact asset count, location, and ownership with evidence.",
  },
  {
    title: "No Central Health Picture",
    body: "Coverage signals live in separate OT, engineering, and security tools with no shared truth.",
  },
  {
    title: "CMDB Pipeline Breaks",
    body: "Low-confidence inventory data fails downstream governance, lifecycle, and compliance workflows.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Ingest",
    body: "Connect OT discovery, engineering exports, endpoint tools, and manual sources.",
  },
  {
    step: "2",
    title: "Rebuild",
    body: "Generate a plant-level map with line/unit context and asset evidence provenance.",
  },
  {
    step: "3",
    title: "Validate",
    body: "Measure completeness and continuity including redundancy and baseline operability checks.",
  },
  {
    step: "4",
    title: "Cover",
    body: "Show what is securable, what is covered, and what still needs baseline controls.",
  },
];

const PRICING = [
  {
    tier: "Starter",
    price: "$2,500",
    sub: "per month",
    audience: "Single pilot plant",
    features: ["Up to 5,000 assets", "Core connectors", "Inventory + coverage baseline", "CMDB export"],
    cta: "Start Pilot",
    featured: false,
  },
  {
    tier: "Growth",
    price: "$8,500",
    sub: "per month",
    audience: "Multi-plant operators",
    features: ["Up to 50,000 assets", "Portfolio dashboard", "Agentic continuity checks", "Priority support"],
    cta: "Book Demo",
    featured: true,
  },
  {
    tier: "Enterprise",
    price: "Custom",
    sub: "annual contract",
    audience: "Critical infrastructure / public sector",
    features: ["Unlimited plants", "SSO + RBAC + audit logs", "Private deployment options", "Program support"],
    cta: "Talk to Sales",
    featured: false,
  },
];

const ROI_SCENARIOS = [
  { scope: "Pilot Plant", assets: "5,000 assets · 1 plant", annualValue: "$190k", payback: "3.2 months" },
  { scope: "Regional Cluster", assets: "18,000 assets · 4 plants", annualValue: "$910k", payback: "2.1 months" },
  { scope: "Enterprise Fleet", assets: "60,000 assets · 12 plants", annualValue: "$3.2M", payback: "1.4 months" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#060b16] text-slate-100">
      <div className="absolute inset-0 pointer-events-none opacity-70">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-40 right-0 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <header className="pt-6 flex items-center justify-between">
          <PlantTraceLogo />
          <div className="flex items-center gap-2">
            <Link href="/framework" className="px-3 py-2 text-sm rounded-md border border-slate-700 hover:border-slate-500">
              Framework
            </Link>
            <Link href="/roi" className="px-3 py-2 text-sm rounded-md border border-slate-700 hover:border-slate-500">
              ROI Model
            </Link>
            <Link href="/inventory" className="px-3 py-2 text-sm rounded-md bg-cyan-400 text-slate-950 font-medium hover:bg-cyan-300">
              Run Analysis
            </Link>
          </div>
        </header>

        <section className="mt-14 grid lg:grid-cols-2 gap-10 items-center">
          <div className="animate-fade-up">
            <p className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              OT Asset Assurance for Multi-Plant Operations
            </p>
            <h1 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-tight">
              Reconstruct The Plant.
              <br />
              Control The Surface.
            </h1>
            <p className="mt-5 text-slate-300 text-lg max-w-xl">
              PlantTrace reduces wasted labor, rework, and avoidable outage exposure by building a trustworthy OT
              asset baseline with evidence provenance and coverage status.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/inventory" className="px-5 py-3 rounded-md bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300">
                Start With a Site
              </Link>
              <Link href="/framework" className="px-5 py-3 rounded-md border border-slate-600 hover:border-slate-400">
                See How It Works
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
              <Metric label="Asset Confidence" value="94%" />
              <Metric label="Coverage Gaps Found" value="29%" />
              <Metric label="CMDB Ready Assets" value="81%" />
            </div>
          </div>

          <HeroPlantMap />
        </section>

        <section className="mt-12">
          <ConversionPanel />
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">The Problems We Solve</h2>
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            {PROBLEMS.map((problem) => (
              <div key={problem.title} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="font-semibold text-lg">{problem.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{problem.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-rose-600/40 bg-rose-950/30 p-6">
          <h2 className="text-2xl font-semibold">Cost of Not Solving This</h2>
          <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
            <Tag text="Repeated manual reconciliation every month" />
            <Tag text="Coverage gaps discovered late after incidents" />
            <Tag text="CMDB rework loops from low-confidence records" />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">How PlantTrace Works</h2>
          <p className="mt-2 text-slate-300">Context first, risk later. Inventory truth and coverage baseline are the foundation.</p>
          <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((item) => (
              <div key={item.step} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-cyan-300 text-sm font-semibold">Step {item.step}</div>
                <h3 className="mt-1 font-semibold text-lg">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold">Built for Public Sector and Critical Infrastructure</h2>
          <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <Tag text="Multi-tenant site isolation" />
            <Tag text="Role-based access + audit logs" />
            <Tag text="Evidence provenance per asset" />
            <Tag text="CMDB export and system-of-record sync" />
            <Tag text="Portfolio-level cross-plant view" />
            <Tag text="Supports contractor and owner workflows" />
          </div>
        </section>

        <section className="mt-16">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold">ROI Scales With Scope</h2>
              <p className="mt-2 text-slate-300">As plants and assets increase, labor, outage, and rework savings compound.</p>
            </div>
            <Link href="/roi" className="px-4 py-2 rounded-md border border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/10 text-sm">
              Open ROI Calculator
            </Link>
          </div>
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            {ROI_SCENARIOS.map((item) => (
              <div key={item.scope} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-sm text-slate-300">{item.scope}</div>
                <div className="text-xs text-slate-400 mt-1">{item.assets}</div>
                <div className="mt-4 text-3xl font-semibold text-cyan-300">{item.annualValue}</div>
                <div className="text-xs text-slate-400 mt-1">Estimated annual net value</div>
                <div className="mt-3 inline-flex px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200">
                  Payback: {item.payback}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold">Pricing</h2>
              <p className="mt-2 text-slate-300">Start with one plant. Expand to portfolio governance.</p>
            </div>
            <div className="text-xs text-slate-400">Illustrative pricing for planning</div>
          </div>

          <div className="mt-5 grid lg:grid-cols-3 gap-4">
            {PRICING.map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-xl p-5 border ${plan.featured ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-900/70"}`}
              >
                <div className="text-sm text-slate-300">{plan.tier}</div>
                <div className="mt-1 text-3xl font-semibold">{plan.price}</div>
                <div className="text-xs text-slate-400">{plan.sub}</div>
                <p className="mt-3 text-sm text-slate-300">{plan.audience}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  {plan.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <button className={`mt-5 w-full py-2.5 rounded-md text-sm font-semibold ${plan.featured ? "bg-cyan-400 text-slate-950" : "bg-slate-800 hover:bg-slate-700"}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-blue-900/40 p-8">
          <h2 className="text-3xl font-semibold">Start With One Plant This Week</h2>
          <p className="mt-3 text-slate-300 max-w-2xl">
            Connect your first data sources, generate a trusted baseline, and identify exactly where coverage needs to improve.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/inventory" className="px-5 py-3 rounded-md bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300">
              Run First Analysis
            </Link>
            <Link href="/framework" className="px-5 py-3 rounded-md border border-slate-600 hover:border-slate-400">
              Review Framework
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroPlantMap() {
  const nodes = [
    { x: 94, y: 196, label: "Distillation", status: "92%" },
    { x: 216, y: 138, label: "Utilities", status: "88%" },
    { x: 338, y: 182, label: "Packaging", status: "95%" },
    { x: 454, y: 112, label: "Control", status: "97%" },
    { x: 516, y: 218, label: "Storage", status: "86%" },
  ];

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 to-[#070d1d] p-5 animate-float-slow shadow-[0_0_80px_-24px_rgba(34,211,238,0.35)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-slate-200">Operational Digital Twin Snapshot</div>
        <div className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
          Live continuity model
        </div>
      </div>

      <div className="relative h-[340px] overflow-hidden rounded-xl border border-slate-700/70 bg-[#040916]">
        <div className="absolute inset-0 app-grid-bg opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.20),transparent_35%)]" />
        <div className="absolute inset-y-0 -left-1/3 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent animate-scan-slow" />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 340" fill="none" aria-hidden>
          <path d="M20 254 L94 196 L216 138 L338 182 L454 112 L516 218 L600 170" stroke="#0ea5e9" strokeWidth="2.5" strokeDasharray="4 6" />
          <path d="M24 288 L136 246 L262 270 L398 236 L564 276" stroke="#22d3ee" strokeWidth="2" strokeDasharray="7 7" />
        </svg>

        {nodes.map((node) => (
          <div key={node.label} className="absolute" style={{ left: `${(node.x / 620) * 100}%`, top: `${(node.y / 340) * 100}%`, transform: "translate(-50%, -50%)" }}>
            <div className="hero-node-pulse h-4 w-4 rounded-full border border-cyan-300 bg-cyan-300/40 shadow-[0_0_22px_rgba(34,211,238,0.8)]" />
            <div className="mt-2 min-w-[110px] rounded-md border border-slate-600/70 bg-slate-900/80 px-2 py-1 text-[10px]">
              <div className="text-slate-200">{node.label}</div>
              <div className="text-cyan-300">Coverage {node.status}</div>
            </div>
          </div>
        ))}

        <div className="absolute left-3 top-3 rounded-md border border-slate-600 bg-slate-900/90 px-2 py-1 text-xs text-slate-200">
          8,742 named assets across 3 plants
        </div>
        <div className="absolute right-3 top-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
          341 baseline coverage gaps
        </div>
        <div className="absolute bottom-3 left-3 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
          81% CMDB ready with evidence
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return <div className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2">{text}</div>;
}
