import Link from "next/link";
import BaseloadLogo from "@/components/marketing/BaseloadLogo";
import IndustrialTrackerNav from "@/components/platform/IndustrialTrackerNav";
import type { IntelligenceLayerDefinition } from "@/lib/platform/intelligence-stack";

export default function IndustrialTrackerLayerPage({
  layer,
}: {
  layer: IntelligenceLayerDefinition;
}) {
  return (
    <div className="min-h-screen bg-[#071019] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <BaseloadLogo href="/" />
          <div className="flex items-center gap-3">
            <Link
              href="/industrial-tracker"
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60"
            >
              Tracker Overview
            </Link>
            <Link
              href="/planttrace"
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60"
            >
              Mission Map
            </Link>
          </div>
        </header>

        <main className="mt-14">
          <div className="max-w-5xl">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Industrial Tracker</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{layer.name}</h1>
            <p className="mt-4 max-w-3xl text-base text-slate-300 md:text-lg">{layer.tagline}</p>
          </div>

          <IndustrialTrackerNav activeHref={layer.href} className="mt-8" />

          <div className="mt-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Layer Role</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">How this layer fits the stack</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{layer.description}</p>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Questions this layer answers</p>
                <div className="mt-4 space-y-3">
                  {layer.questions.map((question) => (
                    <div
                      key={question}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200"
                    >
                      {question}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Source Roadmap</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Datasets that strengthen this layer</h2>
              <div className="mt-5 space-y-3">
                {layer.sources.map((source) => (
                  <div
                    key={source}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200"
                  >
                    {source}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Product Logic</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">What this means for Baseload</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-sm font-medium text-white">Industrial Tracker</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Uses this layer to map the outside-the-fence industrial system and rank momentum.
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-sm font-medium text-white">Facility Graph</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Preserves raw evidence so the graph stays auditable as the central platform asset.
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-sm font-medium text-white">Mission Map</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Consumes the signals generated here to improve plant reconstruction and OT inference.
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
