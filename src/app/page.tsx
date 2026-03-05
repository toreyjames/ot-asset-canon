import Link from "next/link";
import PlantTraceLogo from "@/components/marketing/PlantTraceLogo";
import ConversionPanel from "@/components/marketing/ConversionPanel";

const CORE_PAIN = [
  {
    title: "You Cannot Improve What You Cannot See",
    body: "Asset truth is fragmented across teams, tools, and spreadsheets. PlantTrace turns that chaos into one clear operational picture.",
  },
  {
    title: "Great Teams Still Lose Time",
    body: "Even strong engineering and security teams burn cycles reconciling the same answers. We remove that repetition.",
  },
  {
    title: "CMDB Efforts Stall Without Trusted Inputs",
    body: "When source data is shaky, every downstream initiative slows down. We make the upstream layer reliable first.",
  },
];

const FLOW = [
  {
    title: "Connect",
    body: "Bring in OT discovery, engineering context, and existing security telemetry without forcing tool replacement.",
  },
  {
    title: "Rebuild",
    body: "Generate a living plant map that reflects what exists, where it lives, and what can actually be secured.",
  },
  {
    title: "Align",
    body: "Give operations, engineering, and security one shared baseline so everyone works from the same truth.",
  },
  {
    title: "Scale",
    body: "Move from one site to many with consistent playbooks, cleaner handoffs, and stronger portfolio visibility.",
  },
];

const PLANS = [
  {
    name: "Pilot",
    description: "Prove value quickly at one plant",
    detail: "Fast onboarding, focused scope, clear handoff",
    cta: "Start Pilot",
  },
  {
    name: "Program",
    description: "Standardize across multiple plants",
    detail: "Multi-plant governance and portfolio rollout",
    cta: "Book Program Call",
    featured: true,
  },
  {
    name: "Enterprise",
    description: "Mission-critical operating model",
    detail: "Private deployment, controls, and long-term partnership",
    cta: "Talk Enterprise",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050915] text-slate-100">
      <div className="absolute inset-0 pointer-events-none opacity-80">
        <div className="absolute -top-12 -left-12 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <header className="pt-6 flex items-center justify-between">
          <PlantTraceLogo />
          <div className="flex items-center gap-2">
            <Link href="/framework" className="px-3 py-2 text-sm rounded-md border border-slate-700 hover:border-cyan-400/60">
              Framework
            </Link>
            <Link href="/roi" className="px-3 py-2 text-sm rounded-md border border-slate-700 hover:border-cyan-400/60">
              Value
            </Link>
            <Link href="/inventory" className="px-3 py-2 text-sm rounded-md bg-cyan-400 text-slate-950 font-medium hover:bg-cyan-300">
              Experience Demo
            </Link>
          </div>
        </header>

        <section className="mt-14 grid lg:grid-cols-[1.08fr_1fr] gap-10 items-center section-pop">
          <div className="animate-fade-up">
            <p className="inline-flex items-center rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              Built for OT teams that want momentum, not friction
            </p>
            <h1 className="mt-5 text-4xl md:text-7xl font-semibold tracking-tight leading-[0.92] headline-display">
              Reindustrialize With Clarity.
              <br />
              Plant Floor To CMDB.
            </h1>
            <p className="mt-5 text-slate-300 text-lg max-w-xl">
              PlantTrace is the operational data layer between real plant assets and enterprise systems. We rebuild what exists,
              prove what is secureable, and deliver clean structure downstream to CMDB and governance teams.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/inventory" className="px-5 py-3 rounded-md bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300">
                Start With One Plant
              </Link>
              <Link href="/framework" className="px-5 py-3 rounded-md border border-slate-600 hover:border-cyan-400/70">
                See The Method
              </Link>
            </div>

            <div className="mt-8 grid sm:grid-cols-3 gap-3 text-sm">
              <Pill text="Fewer blind spots" />
              <Pill text="Faster decisions" />
              <Pill text="Cleaner handoffs" />
            </div>
          </div>

          <HeroPlantMap />
        </section>

        <Ribbon
          items={[
            "Reindustrialize with evidence-backed plant visibility",
            "The operational layer between OT reality and CMDB systems",
            "Map what exists, prove what is securable, then scale",
            "One shared truth for operations, engineering, and security",
          ]}
        />

        <section className="mt-14 section-pop">
          <ConversionPanel />
        </section>

        <section className="mt-16 section-pop">
          <h2 className="text-3xl font-semibold">Why Teams Bring In PlantTrace</h2>
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            {CORE_PAIN.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-cyan-700/35 bg-gradient-to-r from-cyan-900/25 to-blue-900/20 p-6 section-pop">
          <h2 className="text-2xl font-semibold">What Makes This Feel Different</h2>
          <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
            <Tag text="Modern UX your team actually wants to use" />
            <Tag text="Visual plant context, not abstract spreadsheets" />
            <Tag text="Built to flow into CMDB and long-term governance" />
          </div>
        </section>

        <section className="mt-16 section-pop">
          <h2 className="text-3xl font-semibold">How It Flows</h2>
          <p className="mt-2 text-slate-300">Simple path, serious output.</p>
          <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FLOW.map((item, index) => (
              <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="text-xs uppercase tracking-wide text-cyan-300">Phase {index + 1}</div>
                <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 section-pop">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-semibold">Engagement Paths</h2>
              <p className="mt-2 text-slate-300">Start lean, expand with confidence.</p>
            </div>
            <Link href="/roi" className="px-4 py-2 rounded-md border border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/10 text-sm">
              Open Value Model
            </Link>
          </div>

          <div className="mt-5 grid lg:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${plan.featured ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-900/70"}`}
              >
                <div className="text-sm text-slate-300">{plan.name}</div>
                <div className="mt-2 text-xl font-semibold">{plan.description}</div>
                <p className="mt-2 text-sm text-slate-300">{plan.detail}</p>
                <button className={`mt-5 w-full py-2.5 rounded-md text-sm font-semibold ${plan.featured ? "bg-cyan-400 text-slate-950" : "bg-slate-800 hover:bg-slate-700"}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-blue-900/40 p-8 section-pop">
          <h2 className="text-3xl font-semibold">Build Clarity. Keep Your Edge.</h2>
          <p className="mt-3 text-slate-300 max-w-2xl">
            Start with one plant, prove the workflow, then roll out with a model your teams trust and enjoy using.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/inventory" className="px-5 py-3 rounded-md bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300">
              Run First Experience
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

function Ribbon({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="mt-12 overflow-hidden rounded-xl border border-cyan-500/30 bg-cyan-500/10 py-2">
      <div className="animate-marquee whitespace-nowrap text-sm font-medium text-cyan-100 tracking-wide">
        {loop.map((item, i) => (
          <span key={`${item}-${i}`} className="mx-8">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroPlantMap() {
  const nodes = [
    { x: 94, y: 196, label: "Distillation", status: "Mapped" },
    { x: 216, y: 138, label: "Utilities", status: "Verified" },
    { x: 338, y: 182, label: "Packaging", status: "Aligned" },
    { x: 454, y: 112, label: "Control", status: "Securable" },
    { x: 516, y: 218, label: "Storage", status: "Tracked" },
  ];

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 to-[#070d1d] p-5 animate-float-slow shadow-[0_0_80px_-24px_rgba(34,211,238,0.35)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-slate-200">Plant Reality Canvas</div>
        <div className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
          continuity + coverage view
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
              <div className="text-cyan-300">{node.status}</div>
            </div>
          </div>
        ))}

        <div className="absolute left-3 top-3 rounded-md border border-slate-600 bg-slate-900/90 px-2 py-1 text-xs text-slate-200">
          live map assembling
        </div>
        <div className="absolute right-3 top-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
          smart gaps highlighted
        </div>
        <div className="absolute bottom-3 left-3 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
          ready for action
        </div>
      </div>
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <div className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-center text-slate-200">
      {text}
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return <div className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2">{text}</div>;
}
