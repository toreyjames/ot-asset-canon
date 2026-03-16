import Link from "next/link";
import { FactsPanel, FreshnessPanel, ProvenancePanel } from "@/components/canonical/CanonicalPanels";
import { BaseloadSpecPage, SpecBlock, SpecMetricGrid } from "@/components/platform/BaseloadSpec";
import { getAssetProfile } from "@/lib/canonical/service";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId: rawAssetId } = await params;
  const assetId = decodeURIComponent(rawAssetId);
  const asset = await getAssetProfile(assetId);

  return (
    <BaseloadSpecPage
      title={asset.assetName}
      subtitle={`${asset.assetType} • ${asset.facilityName}`}
      actions={
        <>
          <Link href={`/facility/${asset.facilityId}`} className="spec-link">
            FACILITY
          </Link>
          <Link href={`/mission-map/${asset.facilityId}`} className="spec-link">
            MISSION
          </Link>
        </>
      }
    >
      <SpecBlock title="Asset Summary">
        <SpecMetricGrid
          metrics={[
            ["Asset Type", asset.assetType],
            ["Confidence", asset.confidence],
            ["Facility", asset.facilityName],
            ["Dependencies", asset.dependencyContext.length.toString()],
          ]}
        />
      </SpecBlock>

      <SpecBlock title="Dependency Context">
        <div className="flex flex-wrap gap-2">
          {asset.dependencyContext.map((dependency) => (
            <span
              key={dependency}
              className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300"
            >
              {dependency}
            </span>
          ))}
        </div>
      </SpecBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Freshness">
          <FreshnessPanel freshness={asset.freshness} />
        </SpecBlock>
        <SpecBlock title="Facts">
          <FactsPanel facts={asset.facts} />
        </SpecBlock>
      </div>

      <SpecBlock title="Provenance">
        <ProvenancePanel provenance={asset.provenance} />
      </SpecBlock>
    </BaseloadSpecPage>
  );
}
