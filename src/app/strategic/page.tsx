import Link from "next/link";
import { BaseloadSpecPage, SpecBlock, SpecDataTable, SpecMetricGrid } from "@/components/platform/BaseloadSpec";
import { getStrategicView } from "@/lib/canonical/service";
import { loadIndustrialTrackerDashboard } from "@/lib/industrial-tracker/dashboard";

function formatMoney(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

export default async function StrategicPage() {
  const strategic = await getStrategicView();
  const dashboard = await loadIndustrialTrackerDashboard();
  const staleThresholdMs = 1000 * 60 * 60 * 24 * 30;
  const staleSources = dashboard.coverageItems.filter((item) => {
    const observed = new Date(item.latestObservedAt).getTime();
    return Number.isFinite(observed) && Date.now() - observed > staleThresholdMs;
  });
  const freshestSource = [...dashboard.coverageItems]
    .sort((a, b) => b.latestObservedAt.localeCompare(a.latestObservedAt))
    .at(0);

  return (
    <BaseloadSpecPage
      title="Strategic Map"
      subtitle="capital + infrastructure + cluster formation"
      actions={
        <Link href="/framework/canonical-explorer" className="spec-link">
          EXPLORER
        </Link>
      }
    >
      <SpecBlock title="Strategic Metrics">
        <SpecMetricGrid
          metrics={[
            ["Tracked Capital", formatMoney(strategic.metrics.totalTrackedUsd)],
            ["Facilities", strategic.metrics.facilityCount.toLocaleString()],
            ["Infrastructure", strategic.metrics.infrastructureNodeCount.toLocaleString()],
            ["Evidence", strategic.metrics.evidenceCount.toLocaleString()],
            ["Queue Projects", strategic.metrics.queueProjectCount.toLocaleString()],
            ["Generated", new Date(strategic.generatedAt).toLocaleDateString("en-US")],
          ]}
        />
      </SpecBlock>

      <SpecBlock title="Live Refresh Reliability">
        <SpecMetricGrid
          metrics={[
            ["Runtime Mode", dashboard.mode.toUpperCase()],
            [
              "Latest Source Observation",
              freshestSource
                ? new Date(freshestSource.latestObservedAt).toLocaleDateString("en-US")
                : "Unknown",
            ],
            ["Tracked Sources", dashboard.coverageItems.length.toLocaleString()],
            ["Stale Sources (>30d)", staleSources.length.toLocaleString()],
            ["Facility Timeline Rows", dashboard.facilityTimeline.length.toLocaleString()],
            [
              "Graph Generated",
              new Date(dashboard.generatedAt).toLocaleDateString("en-US"),
            ],
          ]}
        />
      </SpecBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Top Regions">
          <SpecDataTable
            title="County / regional concentration"
            rows={strategic.topRegions.slice(0, 8).map((row) => ({
              label: row.label,
              value: formatMoney(row.totalAmountUsd),
              meta: `${row.eventCount} events • ${row.permitEventCount} permit signals`,
            }))}
          />
        </SpecBlock>

        <SpecBlock title="Top Sectors">
          <SpecDataTable
            title="Sector concentration"
            rows={strategic.topSectors.slice(0, 8).map((row) => ({
              label: row.label,
              value: formatMoney(row.valueUsd),
              meta: `${row.projectCount} indexed projects`,
            }))}
          />
        </SpecBlock>
      </div>
    </BaseloadSpecPage>
  );
}
