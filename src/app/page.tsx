import Link from "next/link";
import PlantTraceLogo from "@/components/marketing/PlantTraceLogo";

const PRINCIPLES = [
  "One trusted asset baseline",
  "Evidence from OT + engineering data",
  "Coverage clarity before risk layering",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050915] text-slate-100">
      <div className="absolute inset-0 pointer-events-none opacity-80">
        <div className="absolute -top-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-6 sm:px-6">
        <header className="flex items-center justify-between">
          <PlantTraceLogo />
          <Link
            href="/auth"
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60"
          >
            Login
          </Link>
        </header>

        <main className="mx-auto mt-16 flex w-full max-w-4xl flex-1 flex-col items-center text-center">
          <p className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
            PlantTrace
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-7xl headline-display">
            Know What You Have.
            <br />
            Run It In Minutes.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-300 md:text-lg">
            Rebuild plant reality from evidence, generate a canonical asset baseline, and verify what is secured.
            No setup maze. One guided run.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/inventory?demo=1"
              className="rounded-md bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Run Demo Now
            </Link>
            <Link
              href="/inventory"
              className="rounded-md border border-slate-600 px-6 py-3 text-sm hover:border-cyan-400/70"
            >
              View Inventory
            </Link>
          </div>

          <div className="mt-14 grid w-full gap-3 md:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
