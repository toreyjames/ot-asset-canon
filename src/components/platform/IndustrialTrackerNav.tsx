import Link from "next/link";
import { INDUSTRIAL_TRACKER_LAYERS } from "@/lib/platform/intelligence-stack";

export default function IndustrialTrackerNav({
  activeHref,
  className = "",
}: {
  activeHref: string;
  className?: string;
}) {
  return (
    <nav className={`flex flex-wrap items-center gap-2 ${className}`}>
      {INDUSTRIAL_TRACKER_LAYERS.map((layer) => {
        const isActive = activeHref === layer.href;
        return (
          <Link
            key={layer.id}
            href={layer.href}
            className={`rounded-full border px-3 py-2 text-sm transition-colors ${
              isActive
                ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100"
                : "border-slate-700 text-slate-300 hover:border-cyan-400/60 hover:text-white"
            }`}
          >
            {layer.shortName}
          </Link>
        );
      })}
    </nav>
  );
}
