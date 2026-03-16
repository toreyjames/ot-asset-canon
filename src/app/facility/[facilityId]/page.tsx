import Link from "next/link";
import { notFound } from "next/navigation";
import { FactsPanel, FreshnessPanel, IdentityPanel, ProvenancePanel } from "@/components/canonical/CanonicalPanels";
import { BaseloadSpecPage, SpecBlock, SpecDataTable } from "@/components/platform/BaseloadSpec";
import { getFacilityProfile } from "@/lib/canonical/service";

export default async function FacilityPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId: rawFacilityId } = await params;
  const facilityId = decodeURIComponent(rawFacilityId);
  const facility = await getFacilityProfile(facilityId);
  if (!facility) notFound();

  return (
    <BaseloadSpecPage
      title={facility.facilityName}
      subtitle={`facility view • ${facility.geography}`}
      actions={
        <>
          <Link href={`/mission-map/${facility.facilityId}`} className="spec-link">
            MISSION
          </Link>
          <Link href="/strategic" className="spec-link">
            STRATEGIC
          </Link>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Identity">
          <IdentityPanel
            canonicalId={facility.identity.canonicalId}
            resolutionBasis={facility.identity.resolutionBasis}
            sourceIds={facility.identity.sourceIds}
          />
        </SpecBlock>
        <SpecBlock title="Freshness">
          <FreshnessPanel freshness={facility.freshness} />
        </SpecBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Program Links">
          <SpecDataTable
            title="Observed regulatory / system anchors"
            rows={facility.programLinks.map((link) => ({
              label: link.programType,
              value: link.externalProgramId,
              meta: link.agency || "agency unknown",
            }))}
          />
        </SpecBlock>
        <SpecBlock title="Event Timeline">
          <SpecDataTable
            title="Latest facility events"
            rows={facility.eventTimeline.slice(0, 8).map((event) => ({
              label: event.eventType.replace(/_/g, " "),
              value: event.occurredAt ? new Date(event.occurredAt).toLocaleDateString("en-US") : "unknown",
              meta: event.id,
            }))}
          />
        </SpecBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Facts">
          <FactsPanel facts={facility.facts} />
        </SpecBlock>
        <SpecBlock title="Provenance">
          <ProvenancePanel provenance={facility.provenance} />
        </SpecBlock>
      </div>
    </BaseloadSpecPage>
  );
}
