import Link from "next/link";
import { PLATFORM_BRAND } from "@/lib/platform/brand";

export default function BaseloadLogo({
  href = "/",
  compact = false,
  accent = "light",
}: {
  href?: string;
  compact?: boolean;
  accent?: "light" | "dark";
}) {
  const titleClass = accent === "dark" ? "text-slate-100" : "text-white";
  const subtitleClass = accent === "dark" ? "text-slate-400" : "text-slate-400";
  const frameFill = accent === "dark" ? "#F4F0E8" : "#08121C";
  const frameStroke = accent === "dark" ? "#C9B79C" : "#28465E";
  const lineBase = accent === "dark" ? "#17324A" : "#E7D9BF";
  const lineAccent = accent === "dark" ? "#0F8C8C" : "#75E6D1";
  const lineWarm = accent === "dark" ? "#B17632" : "#F0B46A";

  return (
    <Link href={href} className="flex items-center gap-3">
      <svg width="40" height="40" viewBox="0 0 72 72" fill="none" aria-hidden>
        <rect x="3" y="3" width="66" height="66" rx="18" fill={frameFill} stroke={frameStroke} strokeWidth="2" />
        <path d="M18 49C18 36.8 27.8 27 40 27H54V35H40C32.2 35 26 41.2 26 49V54H18V49Z" fill={lineBase} />
        <path d="M23 22H31V54H23V22Z" fill={lineAccent} opacity="0.95" />
        <path d="M37 18H54V26H45.5C40.8 26 37 29.8 37 34.5V54H29V26C29 21.6 32.6 18 37 18Z" fill={lineWarm} opacity="0.9" />
        <circle cx="51" cy="21" r="3" fill={lineAccent} />
      </svg>
      {!compact && (
        <div>
          <div className={`font-semibold text-lg tracking-tight ${titleClass}`}>
            {PLATFORM_BRAND.companyName}
          </div>
          <div className={`text-[11px] uppercase tracking-[0.28em] ${subtitleClass}`}>
            {PLATFORM_BRAND.tagline}
          </div>
        </div>
      )}
    </Link>
  );
}
