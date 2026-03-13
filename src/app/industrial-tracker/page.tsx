import Link from "next/link";
import { loadIndustrialTrackerDashboard } from "@/lib/industrial-tracker/dashboard";

function formatMoney(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

function formatEnergy(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M MWh`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k MWh`;
  return `${value.toLocaleString()} MWh`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const INPUT_SOURCES = ["OT discovery", "Engineering docs", "CMDB", "PLC / SCADA"];

const CORE_FUNCTIONS = ["Reconciliation", "Dependency graph", "Gap detection", "Confidence scoring"];

export default async function IndustrialTrackerPage() {
  const dashboard = await loadIndustrialTrackerDashboard();
  const staleThresholdMs = 1000 * 60 * 60 * 24 * 30;
  const staleCoverageCount = dashboard.coverageItems.filter((item) => {
    const observedAt = new Date(item.latestObservedAt).getTime();
    return Number.isFinite(observedAt) && Date.now() - observedAt > staleThresholdMs;
  }).length;
  const freshestCoverage = [...dashboard.coverageItems]
    .sort((a, b) => b.latestObservedAt.localeCompare(a.latestObservedAt))
    .at(0);

  const headlineMetrics = [
    ["Federal Capital (Signal)", formatMoney(dashboard.totalTrackedUsd)],
    ["Indexed Projects", dashboard.investmentEventCount.toLocaleString()],
    ["Facilities Indexed", dashboard.facilityCount.toLocaleString()],
    ["Infrastructure Nodes", dashboard.infrastructureNodeCount.toLocaleString()],
    ["Evidence Records", dashboard.evidenceCount.toLocaleString()],
    ["Generation Indexed", formatEnergy(dashboard.totalGenerationMwh)],
  ] as const;

  const outputItems = [
    `Machine-readable infrastructure graph (${dashboard.infrastructureNodeCount.toLocaleString()} nodes)`,
    `Operational topology visualization (${dashboard.facilityCount.toLocaleString()} facilities)`,
    `Gap detection and risk mapping (${dashboard.permitEventCount.toLocaleString()} permit events)`,
    `Confidence-linked evidence layers (${dashboard.evidenceCount.toLocaleString()} evidence records)`,
    `API-accessible system model (${dashboard.countyCoverageCount.toLocaleString()} ranked counties)`,
  ];

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
            <line x1="120" y1="220" x2="180" y2="170" />
            <line x1="450" y1="240" x2="510" y2="190" />
            <line x1="810" y1="210" x2="870" y2="160" />
            <line x1="1180" y1="250" x2="1240" y2="200" />
            <line x1="120" y1="220" x2="120" y2="820" />
            <line x1="450" y1="240" x2="450" y2="840" />
            <line x1="810" y1="210" x2="810" y2="860" />
            <line x1="1180" y1="250" x2="1180" y2="880" />
            <line x1="120" y1="820" x2="180" y2="770" />
            <line x1="450" y1="840" x2="510" y2="790" />
            <line x1="810" y1="860" x2="870" y2="810" />
            <line x1="1180" y1="880" x2="1240" y2="830" />
          </g>
          <g fill="currentColor" className="spec-svg-text">
            <text x="130" y="205">PROCESS BLOCK A</text>
            <text x="460" y="225">REFINING LINE B</text>
            <text x="820" y="195">MIXING & HEAT ZONE</text>
            <text x="1190" y="235">PACKAGING BAY</text>
            <text x="126" y="1000">SYSTEM VIEW: INDUSTRIAL PLANT LAYOUT (SCHEMATIC)</text>
          </g>
        </svg>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <header className="spec-block px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="spec-flag" aria-hidden="true" />
                <p className="spec-eyebrow">BASELOAD</p>
              </div>
              <h1 className="spec-title mt-3">Baseline Asset &amp; System Epistemology</h1>
              <p className="spec-subtitle mt-2">industrial operations intelligence</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="spec-status">STATUS: OPERATIONAL</span>
              <Link href="/auth" className="spec-link">
                LOGIN
              </Link>
            </div>
          </div>
        </header>

        <main className="mt-4 space-y-4">
          <section className="spec-block px-4 py-4 sm:px-6">
            <SectionLabel>System Purpose</SectionLabel>
            <p className="spec-body mt-3 max-w-4xl">Verify plant reality fast: reconcile assets, dependencies, and gaps.</p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="spec-block px-4 py-4 sm:px-6">
              <SectionLabel>Input Sources</SectionLabel>
              <ul className="spec-list mt-3">
                {INPUT_SOURCES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="spec-block px-4 py-4 sm:px-6">
              <SectionLabel>Core Functions</SectionLabel>
              <ul className="spec-list mt-3">
                {CORE_FUNCTIONS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="spec-block px-4 py-4 sm:px-6">
            <SectionLabel>Infrastructure Model Diagram</SectionLabel>
            <div className="spec-diagram mt-3">
              <svg viewBox="0 0 1200 240" className="h-full w-full" role="img" aria-label="Baseload system flow diagram">
                <rect x="1" y="1" width="1198" height="238" fill="none" stroke="rgba(212,212,216,0.4)" />
                <g stroke="rgba(212,212,216,0.55)" fill="none" strokeWidth="1">
                  <rect x="34" y="62" width="220" height="110" />
                  <rect x="316" y="62" width="250" height="110" />
                  <rect x="628" y="62" width="250" height="110" />
                  <rect x="940" y="62" width="226" height="110" />
                  <line x1="254" y1="117" x2="316" y2="117" />
                  <line x1="566" y1="117" x2="628" y2="117" />
                  <line x1="878" y1="117" x2="940" y2="117" />
                  <line x1="110" y1="44" x2="110" y2="62" />
                  <line x1="442" y1="44" x2="442" y2="62" />
                  <line x1="754" y1="44" x2="754" y2="62" />
                  <line x1="1060" y1="44" x2="1060" y2="62" />
                </g>
                <g className="spec-svg-text spec-svg-text-diagram">
                  <text x="56" y="94">INGEST</text>
                  <text x="56" y="116">OT + DOC + CMDB</text>
                  <text x="338" y="94">RECONCILE</text>
                  <text x="338" y="116">DISCOVERED VS MODELED</text>
                  <text x="650" y="94">ANALYZE</text>
                  <text x="650" y="116">DEPENDENCY + GAPS</text>
                  <text x="962" y="94">PUBLISH</text>
                  <text x="962" y="116">GRAPH + API + ACTIONS</text>
                  <text x="58" y="206">
                    TRACEABILITY: SOURCE {"->"} ASSET {"->"} DEPENDENCY {"->"} ACTION
                  </text>
                </g>
              </svg>
            </div>
          </section>

          <section className="spec-block px-4 py-4 sm:px-6">
            <SectionLabel>Capability Metrics</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-px bg-zinc-700 sm:grid-cols-2 lg:grid-cols-3">
              {headlineMetrics.map(([label, value]) => (
                <div key={label} className="bg-[#0a0a0a] px-3 py-3">
                  <div className="spec-cell-label">{label}</div>
                  <div className="spec-cell-value mt-1">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="spec-block px-4 py-4 sm:px-6">
            <SectionLabel>Live Refresh Reliability</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-px bg-zinc-700 sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-[#0a0a0a] px-3 py-3">
                <div className="spec-cell-label">Runtime Mode</div>
                <div className="spec-cell-value mt-1">{dashboard.mode.toUpperCase()}</div>
              </div>
              <div className="bg-[#0a0a0a] px-3 py-3">
                <div className="spec-cell-label">Graph Generated</div>
                <div className="spec-cell-value mt-1">{formatDate(dashboard.generatedAt)}</div>
              </div>
              <div className="bg-[#0a0a0a] px-3 py-3">
                <div className="spec-cell-label">Tracked Sources</div>
                <div className="spec-cell-value mt-1">{dashboard.coverageItems.length.toLocaleString()}</div>
              </div>
              <div className="bg-[#0a0a0a] px-3 py-3">
                <div className="spec-cell-label">Freshest Source</div>
                <div className="spec-cell-value mt-1">
                  {freshestCoverage ? formatDate(freshestCoverage.latestObservedAt) : "Unknown"}
                </div>
              </div>
              <div className="bg-[#0a0a0a] px-3 py-3">
                <div className="spec-cell-label">Stale Sources (&gt;30d)</div>
                <div className="spec-cell-value mt-1">{staleCoverageCount.toLocaleString()}</div>
              </div>
              <div className="bg-[#0a0a0a] px-3 py-3">
                <div className="spec-cell-label">Facility Timeline</div>
                <div className="spec-cell-value mt-1">{dashboard.facilityTimeline.length.toLocaleString()}</div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="spec-block px-4 py-4 sm:px-6">
              <SectionLabel>Official Strategic Capital</SectionLabel>
              <div className="mt-3 divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
                {dashboard.officialCapitalSourceItems.length > 0 ? (
                  dashboard.officialCapitalSourceItems.map((item) => (
                    <div key={item.sourceName} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2">
                      <div>
                        <div className="spec-body">{item.sourceName}</div>
                        <div className="spec-cell-label mt-0.5">{item.projectCount} indexed projects</div>
                      </div>
                      <div className="spec-cell-value">{item.amountLabel}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-3 spec-body">No live non-federal capital records.</div>
                )}
              </div>
            </div>

            <div className="spec-block px-4 py-4 sm:px-6">
              <SectionLabel>Emerging Capital</SectionLabel>
              <div className="mt-3 divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
                {dashboard.structuredCapitalSourceItems.length > 0 ? (
                  dashboard.structuredCapitalSourceItems.map((item) => (
                    <div key={item.sourceName} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2">
                      <div>
                        <div className="spec-body">{item.sourceName}</div>
                        <div className="spec-cell-label mt-0.5">{item.projectCount} indexed projects</div>
                      </div>
                      <div className="spec-cell-value">{item.amountLabel}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-3 spec-body">No live emerging-capital records.</div>
                )}
              </div>
            </div>
          </section>

          <section className="spec-block px-4 py-4 sm:px-6">
            <SectionLabel>Strategic Capital</SectionLabel>
              <div className="mt-3 divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
                {dashboard.topProjectFeedItems.length > 0 ? (
                  dashboard.topProjectFeedItems.map((item) => (
                    <div key={item.facilityId} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2">
                      <div>
                        <div className="spec-body">{item.facilityName}</div>
                        <div className="spec-cell-label mt-0.5">
                          {item.geography} • {item.sourceTag}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="spec-cell-value">{item.amountLabel}</div>
                        <div className="spec-cell-label mt-0.5">{item.status}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-3 spec-body">No live strategic capital records.</div>
                )}
              </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="spec-block px-4 py-4 sm:px-6">
              <SectionLabel>Baseload Analysis</SectionLabel>
              <ul className="spec-list mt-3">
                <li>Required infrastructure</li>
                <li>Discovered infrastructure</li>
                <li>Missing dependencies</li>
                <li>Model-reality divergence</li>
              </ul>
              <div className="mt-4 border border-zinc-700 bg-[#080808] px-3 py-2">
                <div className="spec-cell-label">Latest Observation</div>
                <div className="spec-body mt-1">
                  {dashboard.facilityTimeline[0]
                    ? `${dashboard.facilityTimeline[0].facilityName} • ${formatDate(dashboard.facilityTimeline[0].latestObservedAt)}`
                    : "No recent facility observation available"}
                </div>
              </div>
            </div>

            <div className="spec-block px-4 py-4 sm:px-6">
              <SectionLabel>Output</SectionLabel>
              <ul className="spec-list mt-3">
                {outputItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="spec-block px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <SectionLabel>Top Regions (Live)</SectionLabel>
              <div className="spec-cell-label">as of {formatDate(new Date().toISOString())}</div>
            </div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <DataTable
                title="Top Metros"
                rows={dashboard.topCbsaSummary.rows.slice(0, 6).map((row) => ({
                  label: row.geographyLabel,
                  value: formatMoney(row.totalAmountUsd),
                  meta: `${row.eventCount} events`,
                }))}
              />
              <DataTable
                title="Top Counties"
                rows={dashboard.topCountySummary.rows.slice(0, 6).map((row) => ({
                  label: row.geographyLabel,
                  value: formatMoney(row.totalAmountUsd),
                  meta: `${row.eventCount} events`,
                }))}
              />
            </div>
          </section>

          <section className="spec-block px-4 py-4 sm:px-6">
            <SectionLabel>Operational Renders</SectionLabel>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <div className="spec-visual-panel">
                <p className="spec-cell-label">US Infrastructure Grid</p>
                <svg viewBox="0 0 360 180" className="mt-2 h-36 w-full" role="img" aria-label="US grid map render">
                  <g className="spec-wire-shadow" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M30 98 L60 70 L100 64 L130 78 L172 70 L215 82 L262 74 L318 92 L300 120 L248 130 L186 120 L132 136 L88 126 L44 114 Z" />
                    <line x1="95" y1="100" x2="140" y2="98" />
                    <line x1="140" y1="98" x2="188" y2="94" />
                    <line x1="188" y1="94" x2="230" y2="102" />
                    <line x1="230" y1="102" x2="270" y2="108" />
                  </g>
                  <g className="spec-wire-main" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M30 98 L60 70 L100 64 L130 78 L172 70 L215 82 L262 74 L318 92 L300 120 L248 130 L186 120 L132 136 L88 126 L44 114 Z" />
                    <circle className="spec-node-pulse" cx="95" cy="100" r="4" />
                    <circle className="spec-node-pulse" cx="140" cy="98" r="4" />
                    <circle className="spec-node-pulse" cx="188" cy="94" r="4" />
                    <circle className="spec-node-pulse" cx="230" cy="102" r="4" />
                    <circle className="spec-node-pulse" cx="270" cy="108" r="4" />
                    <line x1="95" y1="100" x2="140" y2="98" />
                    <line x1="140" y1="98" x2="188" y2="94" />
                    <line x1="188" y1="94" x2="230" y2="102" />
                    <line x1="230" y1="102" x2="270" y2="108" />
                  </g>
                </svg>
              </div>
              <div className="spec-visual-panel">
                <p className="spec-cell-label">Refinery Block Layout</p>
                <svg viewBox="0 0 360 180" className="mt-2 h-36 w-full" role="img" aria-label="refinery render">
                  <g className="spec-wire-shadow" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="36" y="64" width="82" height="72" />
                    <rect x="130" y="52" width="106" height="84" />
                    <rect x="250" y="72" width="82" height="64" />
                    <circle cx="78" cy="52" r="16" />
                    <circle cx="292" cy="58" r="14" />
                  </g>
                  <g className="spec-wire-main" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="30" y="70" width="82" height="72" />
                    <rect x="124" y="58" width="106" height="84" />
                    <rect x="244" y="78" width="82" height="64" />
                    <circle cx="72" cy="58" r="16" />
                    <circle cx="286" cy="64" r="14" />
                    <polyline points="88,58 124,58 124,82 230,82 230,70 244,70" />
                    <polyline points="72,142 72,160 286,160 286,142" />
                    <line x1="180" y1="42" x2="180" y2="58" />
                    <line x1="112" y1="70" x2="118" y2="64" />
                    <line x1="230" y1="58" x2="236" y2="52" />
                    <line x1="326" y1="78" x2="332" y2="72" />
                  </g>
                </svg>
              </div>
              <div className="spec-visual-panel">
                <p className="spec-cell-label">Mission Dependency Render</p>
                <svg viewBox="0 0 360 180" className="mt-2 h-36 w-full" role="img" aria-label="mission map render">
                  <g className="spec-wire-shadow" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="24" y="66" width="96" height="46" />
                    <rect x="138" y="36" width="96" height="46" />
                    <rect x="138" y="108" width="96" height="46" />
                    <rect x="252" y="66" width="96" height="46" />
                  </g>
                  <g className="spec-wire-main" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="18" y="72" width="96" height="46" />
                    <rect x="132" y="42" width="96" height="46" />
                    <rect x="132" y="114" width="96" height="46" />
                    <rect x="246" y="72" width="96" height="46" />
                    <line x1="114" y1="95" x2="132" y2="65" />
                    <line x1="114" y1="95" x2="132" y2="137" />
                    <line x1="228" y1="65" x2="246" y2="95" />
                    <line x1="228" y1="137" x2="246" y2="95" />
                    <circle className="spec-node-pulse" cx="66" cy="95" r="3" />
                    <circle className="spec-node-pulse" cx="180" cy="65" r="3" />
                    <circle className="spec-node-pulse" cx="180" cy="137" r="3" />
                    <circle className="spec-node-pulse" cx="294" cy="95" r="3" />
                  </g>
                </svg>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="spec-section-label">{children}</h2>;
}

function DataTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; meta: string }[];
}) {
  return (
    <div>
      <h3 className="spec-table-title">{title}</h3>
      <div className="mt-2 divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2">
              <div>
                <div className="spec-body">{row.label}</div>
                <div className="spec-cell-label mt-0.5">{row.meta}</div>
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
