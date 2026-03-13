import Link from "next/link";
import { notFound } from "next/navigation";
import { FactsPanel, FreshnessPanel, MissionMapPanel, ProvenancePanel } from "@/components/canonical/CanonicalPanels";
import { BaseloadSpecPage, SpecBlock, SpecMetricGrid } from "@/components/platform/BaseloadSpec";
import { getMissionMapView } from "@/lib/canonical/service";

export default async function MissionMapPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId: rawFacilityId } = await params;
  const facilityId = decodeURIComponent(rawFacilityId);
  const mission = await getMissionMapView(facilityId);
  if (!mission) notFound();

  const lineCount = mission.nodes.filter((node) => node.nodeType === "line").length;
  const observedCount = mission.facts.filter((fact) => fact.kind === "observation").length;
  const inferredCount = mission.facts.filter((fact) => fact.kind === "inference").length;
  const lowConfidenceNodeCount = mission.nodes.filter(
    (node) => node.confidence === "unknown" || node.confidence === "disputed"
  ).length;
  const maxHierarchyDepth = mission.nodes.reduce((max, node) => Math.max(max, node.level), 0);

  return (
    <BaseloadSpecPage
      title="Mission Map"
      subtitle={`facility mission graph • ${facilityId}`}
      actions={
        <>
          <Link href={`/facility/${facilityId}`} className="spec-link">
            FACILITY
          </Link>
          <Link href={`/asset/${facilityId}:plc-01`} className="spec-link">
            ASSET
          </Link>
        </>
      }
    >
      <SpecBlock title="Mission Summary">
        <SpecMetricGrid
          metrics={[
            ["Layers", mission.layers.length.toString()],
            ["Nodes", mission.nodes.length.toString()],
            ["Edges", mission.edges.length.toString()],
            ["Line Nodes", lineCount.toString()],
            ["Observed Facts", observedCount.toString()],
            ["Inferred Facts", inferredCount.toString()],
            ["Low Confidence Nodes", lowConfidenceNodeCount.toString()],
            ["Hierarchy Depth", maxHierarchyDepth.toString()],
          ]}
        />
      </SpecBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Freshness">
          <FreshnessPanel freshness={mission.freshness} />
        </SpecBlock>
        <SpecBlock title="Map Layers">
          <div className="flex flex-wrap gap-2">
            {mission.layers.map((layer) => (
              <span
                key={layer}
                className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300"
              >
                {layer}
              </span>
            ))}
          </div>
        </SpecBlock>
      </div>

      <SpecBlock title="Topology">
        <MissionMapPanel nodes={mission.nodes} edges={mission.edges} />
      </SpecBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Facts">
          <FactsPanel facts={mission.facts} />
        </SpecBlock>
        <SpecBlock title="Provenance">
          <ProvenancePanel provenance={mission.provenance} />
        </SpecBlock>
      </div>
    </BaseloadSpecPage>
  );
}
