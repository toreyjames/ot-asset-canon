import type { ReactNode } from "react";

export function BaseloadSpecPage({
  eyebrow = "BASELOAD",
  title,
  subtitle,
  status = "STATUS: OPERATIONAL",
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="industrial-spec min-h-screen bg-[#060606] text-zinc-100">
      <div className="spec-global-watermark" aria-hidden="true">
        <svg viewBox="0 0 1600 1100" className="h-full w-full">
          <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.92">
            <rect x="70" y="120" width="1460" height="860" />
            <rect x="120" y="220" width="280" height="180" />
            <rect x="450" y="240" width="300" height="210" />
            <rect x="810" y="210" width="330" height="240" />
            <rect x="1180" y="250" width="260" height="190" />
            <rect x="140" y="510" width="260" height="220" />
            <rect x="460" y="520" width="300" height="210" />
            <rect x="820" y="530" width="340" height="220" />
            <rect x="1210" y="520" width="220" height="240" />
            <circle cx="260" cy="340" r="60" />
            <circle cx="980" cy="340" r="78" />
            <circle cx="1330" cy="350" r="58" />
            <line x1="260" y1="400" x2="260" y2="510" />
            <line x1="980" y1="418" x2="980" y2="530" />
            <line x1="1330" y1="408" x2="1330" y2="520" />
            <polyline points="400,300 450,300 450,320 750,320 750,290 810,290" />
            <polyline points="1140,330 1180,330 1180,360 1440,360" />
            <polyline points="400,610 460,610 460,640 760,640 760,610 820,610" />
            <polyline points="1160,640 1210,640 1210,670 1430,670" />
            <line x1="260" y1="730" x2="260" y2="840" />
            <line x1="620" y1="730" x2="620" y2="860" />
            <line x1="980" y1="750" x2="980" y2="880" />
            <line x1="1320" y1="760" x2="1320" y2="900" />
            <polyline points="80,900 380,900 380,940 760,940 760,900 1160,900 1160,940 1520,940" />
          </g>
          <g fill="currentColor" className="spec-svg-text">
            <text x="130" y="205">STRUCTURE BLOCK A</text>
            <text x="460" y="225">RELATION GRID B</text>
            <text x="820" y="195">CANONICAL LAYER</text>
            <text x="1190" y="235">GRAPH OUTPUT</text>
            <text x="126" y="1000">SYSTEM VIEW: BASELOAD SPEC SHEET</text>
          </g>
        </svg>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <header className="spec-block px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="spec-flag" aria-hidden="true" />
                <p className="spec-eyebrow">{eyebrow}</p>
              </div>
              <h1 className="spec-title mt-3">{title}</h1>
              {subtitle ? <p className="spec-subtitle mt-2">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="spec-status">{status}</span>
              {actions}
            </div>
          </div>
        </header>

        <main className="mt-4 space-y-4">{children}</main>
      </div>
    </div>
  );
}

export function SpecBlock({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`spec-block px-4 py-4 sm:px-6 ${className}`.trim()}>
      {title ? <h2 className="spec-section-label">{title}</h2> : null}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

export function SpecDataTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; meta?: string }>;
}) {
  return (
    <div>
      <h3 className="spec-table-title">{title}</h3>
      <div className="spec-table-surface mt-2 divide-y">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${row.label}-${row.value}`} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2">
              <div>
                <div className="spec-body">{row.label}</div>
                {row.meta ? <div className="spec-cell-label mt-0.5">{row.meta}</div> : null}
              </div>
              <div className="spec-cell-value">{row.value}</div>
            </div>
          ))
        ) : (
          <div className="px-3 py-3 spec-body">No live records.</div>
        )}
      </div>
    </div>
  );
}

export function SpecMetricGrid({
  metrics,
}: {
  metrics: Array<[label: string, value: string]>;
}) {
  return (
    <div className="spec-metric-grid grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map(([label, value]) => (
        <div key={label} className="spec-metric-cell px-3 py-3">
          <div className="spec-cell-label">{label}</div>
          <div className="spec-cell-value mt-1">{value}</div>
        </div>
      ))}
    </div>
  );
}
