import Link from "next/link";
import { PLATFORM_MODULES } from "@/lib/platform/modules";

export default function PlatformNav({
  className = "",
}: {
  className?: string;
}) {
  return (
    <nav className={`flex items-center gap-2 ${className}`}>
      {PLATFORM_MODULES.map((module) => (
        <Link
          key={module.id}
          href={module.href}
          className="app-nav-link rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {module.name}
        </Link>
      ))}
    </nav>
  );
}
