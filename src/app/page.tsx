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

const DEPLOYMENT_OPTIONS = [
  {
    name: "Option 1: Customer-Managed Cloud",
    body: "PlantTrace runs in the customer's cloud tenant for maximum control, security alignment, and internal governance.",
  },
  {
    name: "Option 2: Hybrid Connector",
    body: "Data collection and mapping run near the plant environment while shared metadata and workflows run in PlantTrace cloud.",
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
            <Link href="/login" className="px-3 py-2 text-sm rounded-md border border-slate-700 hover:border-cyan-400/60">
              Login
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
              PlantTrace is the missing layer between what is on the plant floor and what ends up in your CMDB.
              We combine discovery tools, engineering files, and system logs into one trusted asset view your teams can act on.
            </p>
            <p className="mt-3 text-slate-300 text-base max-w-xl">
              Agent-guided deployment turns onboarding into a repeatable product workflow across single plants, portfolio rollouts,
              and multi-tenant environments.
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
              <Pill text="3-D Facility Explorer" />
              <Pill text="Industrial Graph" />
              <Pill text="Natural Query Engine" />
            </div>
          </div>

          <HeroPlantMap />
        </section>

        <Ribbon
          items={[
            "Reindustrialize with a trusted view of every plant asset",
            "The operational layer between OT reality and CMDB systems",
            "Map what exists, show what can be secured, then scale",
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
          <h2 className="text-3xl font-semibold">Framework + Value At A Glance</h2>
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="text-xs uppercase tracking-wide text-cyan-300">Framework</div>
              <h3 className="mt-2 text-xl font-semibold">Connect, Rebuild, Align, Scale</h3>
              <p className="mt-2 text-sm text-slate-300">
                We start with actual plant data, reconstruct the operating map, align teams on one baseline, then scale cleanly across sites.
              </p>
              <Link href="/framework" className="mt-4 inline-block text-sm text-cyan-300 hover:text-cyan-200">
                Open full framework
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="text-xs uppercase tracking-wide text-cyan-300">Value</div>
              <h3 className="mt-2 text-xl font-semibold">Less Waste, Faster Execution</h3>
              <p className="mt-2 text-sm text-slate-300">
                Teams reduce manual reconciliation, move quicker on coverage actions, and send cleaner data into CMDB and downstream workflows.
              </p>
              <Link href="/roi" className="mt-4 inline-block text-sm text-cyan-300 hover:text-cyan-200">
                Open value model
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-16 section-pop">
          <h2 className="text-3xl font-semibold">Deployment Models</h2>
          <p className="mt-2 text-slate-300">Choose the operating model that fits your security and data requirements.</p>
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            {DEPLOYMENT_OPTIONS.map((option) => (
              <div key={option.name} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-xl font-semibold">{option.name}</h3>
                <p className="mt-2 text-sm text-slate-300">{option.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 section-pop">
          <h2 className="text-3xl font-semibold">Portfolio + Tenant Ready</h2>
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="text-xs uppercase tracking-wide text-cyan-300">Single Plant</div>
              <p className="mt-2 text-sm text-slate-300">Launch quickly with one facility and one operating team.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="text-xs uppercase tracking-wide text-cyan-300">Company Portfolio</div>
              <p className="mt-2 text-sm text-slate-300">Run multiple plants under one company baseline and reporting model.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="text-xs uppercase tracking-wide text-cyan-300">Multi-Tenant</div>
              <p className="mt-2 text-sm text-slate-300">Support complex operators and service models with tenant-level separation.</p>
            </div>
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
  const units = [
    { x: 70, y: 88, w: 120, h: 84, name: "Unit A", type: "Distillation" },
    { x: 212, y: 68, w: 140, h: 94, name: "Utilities", type: "Power + Steam" },
    { x: 374, y: 98, w: 156, h: 86, name: "Control", type: "OT Core" },
    { x: 98, y: 196, w: 148, h: 96, name: "Packaging", type: "Line 1/2" },
    { x: 276, y: 212, w: 122, h: 82, name: "Blending", type: "Process Cell" },
    { x: 426, y: 208, w: 126, h: 88, name: "Tank Farm", type: "Storage" },
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
          <rect x="34" y="44" width="552" height="252" rx="10" stroke="rgba(100,116,139,0.35)" strokeWidth="1.4" />
          <path d="M40 180 H580" stroke="rgba(148,163,184,0.32)" strokeWidth="2" />
          <path d="M310 48 V292" stroke="rgba(148,163,184,0.28)" strokeWidth="2" />
          <path d="M130 172 L130 196 L168 196" stroke="#22d3ee" strokeWidth="2.2" strokeDasharray="5 6" />
          <path d="M282 160 L282 212 L338 212" stroke="#22d3ee" strokeWidth="2.2" strokeDasharray="5 6" />
          <path d="M470 182 L470 208" stroke="#22d3ee" strokeWidth="2.2" strokeDasharray="5 6" />
          <path d="M246 244 H276" stroke="#38bdf8" strokeWidth="2.2" strokeDasharray="5 6" />
          <path d="M398 252 H426" stroke="#38bdf8" strokeWidth="2.2" strokeDasharray="5 6" />
        </svg>

        {units.map((unit) => (
          <div
            key={unit.name}
            className="absolute rounded-md border border-cyan-400/30 bg-slate-900/75 shadow-[0_0_16px_rgba(34,211,238,0.14)]"
            style={{ left: unit.x, top: unit.y, width: unit.w, height: unit.h }}
          >
            <div className="absolute top-2 left-2 text-[10px] text-cyan-200">{unit.name}</div>
            <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-cyan-300/80 hero-node-pulse" />
            <div className="absolute bottom-2 left-2 text-[10px] text-slate-300">{unit.type}</div>
            <div className="absolute bottom-2 right-2 text-[10px] text-emerald-300">tracked</div>
          </div>
        ))}

        {[
          { left: "23%", top: "50%" },
          { left: "45%", top: "57%" },
          { left: "61%", top: "54%" },
          { left: "72%", top: "64%" },
        ].map((point, index) => (
          <div
            key={index}
            className="absolute"
            style={{ left: point.left, top: point.top, transform: "translate(-50%, -50%)" }}
          >
            <div className="hero-node-pulse h-3.5 w-3.5 rounded-full border border-cyan-300 bg-cyan-300/40 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
            <div className="mt-1 text-[9px] text-cyan-200 uppercase tracking-wide">link</div>
          </div>
        ))}

        <div className="absolute left-3 top-3 rounded-md border border-slate-600 bg-slate-900/90 px-2 py-1 text-xs text-slate-200">
          site map + process lanes
        </div>
        <div className="absolute right-3 top-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
          gaps pinned to exact unit zones
        </div>
        <div className="absolute bottom-3 left-3 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
          continuity map synced to asset inventory
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
