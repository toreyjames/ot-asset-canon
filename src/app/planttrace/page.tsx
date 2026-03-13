import Link from "next/link";
import BaseloadLogo from "@/components/marketing/BaseloadLogo";

const CAPABILITIES = [
  {
    title: "Facility Reconstruction",
    description: "Rebuild plant reality from OT, engineering, and network evidence into a machine-readable operational model.",
    href: "/inventory",
  },
  {
    title: "Industrial Graph",
    description: "Traverse assets, dependencies, and consequence paths across the plant model.",
    href: "/explorer",
  },
  {
    title: "Site Portfolio",
    description: "Monitor reconstruction progress, coverage, and gaps across sites.",
    href: "/sites/houston-plant",
  },
];

export default function PlantTracePage() {
  return (
    <div className="min-h-screen bg-[#08111d] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <BaseloadLogo href="/" />
          <Link
            href="/auth"
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60"
          >
            Login
          </Link>
        </header>

        <main className="mt-16">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Mission Map</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            Inside-the-plant intelligence.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-300 md:text-lg">
            Mission Map is the Baseload module for OT assets, control systems, engineering evidence,
            and facility-level operational reality.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <Link
                key={capability.title}
                href={capability.href}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 hover:border-cyan-400/40"
              >
                <h2 className="text-xl font-semibold text-white">{capability.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{capability.description}</p>
                <div className="mt-6 text-sm font-medium text-cyan-300">Open</div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
