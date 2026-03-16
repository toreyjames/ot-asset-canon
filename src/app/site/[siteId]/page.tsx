import Link from "next/link";
import { notFound } from "next/navigation";
import { BaseloadSpecPage, SpecBlock, SpecDataTable } from "@/components/platform/BaseloadSpec";
import { FactsPanel, FreshnessPanel, IdentityPanel, ProvenancePanel } from "@/components/canonical/CanonicalPanels";
import { getSiteProfile } from "@/lib/canonical/service";

export default async function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeURIComponent(rawSiteId);
  const site = await getSiteProfile(siteId);
  if (!site) notFound();

  return (
    <BaseloadSpecPage
      title={site.siteName}
      subtitle={`site intelligence • ${site.geography}`}
      actions={
        <Link href="/strategic" className="spec-link">
          STRATEGIC
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Identity">
          <IdentityPanel
            canonicalId={site.identity.canonicalId}
            resolutionBasis={site.identity.resolutionBasis}
            sourceIds={site.identity.sourceIds}
          />
        </SpecBlock>
        <SpecBlock title="Freshness">
          <FreshnessPanel freshness={site.freshness} />
        </SpecBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Facilities">
          <SpecDataTable
            title="Facility scope"
            rows={site.facilities.map((facility) => ({
              label: facility.facilityName,
              value: facility.facilityId,
            }))}
          />
        </SpecBlock>
        <SpecBlock title="Investments">
          <SpecDataTable
            title="Linked site investments"
            rows={site.investments.map((investment, index) => ({
              label: investment.amountLabel,
              value: investment.status,
              meta: `${investment.sourceTag} • ${index + 1}`,
            }))}
          />
        </SpecBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Facts">
          <FactsPanel facts={site.facts} />
        </SpecBlock>
        <SpecBlock title="Provenance">
          <ProvenancePanel provenance={site.provenance} />
        </SpecBlock>
      </div>
    </BaseloadSpecPage>
  );
}
