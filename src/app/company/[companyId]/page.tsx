import Link from "next/link";
import { notFound } from "next/navigation";
import { BaseloadSpecPage, SpecBlock, SpecDataTable } from "@/components/platform/BaseloadSpec";
import { FactsPanel, FreshnessPanel, IdentityPanel, ProvenancePanel } from "@/components/canonical/CanonicalPanels";
import { getCompanyProfile } from "@/lib/canonical/service";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: rawCompanyId } = await params;
  const companyId = decodeURIComponent(rawCompanyId);
  const company = await getCompanyProfile(companyId);
  if (!company) notFound();

  return (
    <BaseloadSpecPage
      title={company.legalName}
      subtitle="company view"
      actions={
        <Link href="/strategic" className="spec-link">
          STRATEGIC
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Identity">
          <IdentityPanel canonicalId={company.identity.canonicalId} resolutionBasis={company.identity.resolutionBasis} />
        </SpecBlock>
        <SpecBlock title="Freshness">
          <FreshnessPanel freshness={company.freshness} />
        </SpecBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Sites">
          <SpecDataTable
            title="Mapped sites"
            rows={company.sites.map((site) => ({
              label: site.siteName,
              value: site.geography,
              meta: site.siteId,
            }))}
          />
        </SpecBlock>
        <SpecBlock title="Programs">
          <SpecDataTable
            title="Program tags"
            rows={company.programs.map((program) => ({
              label: program,
              value: "active",
            }))}
          />
        </SpecBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Facts">
          <FactsPanel facts={company.facts} />
        </SpecBlock>
        <SpecBlock title="Provenance">
          <ProvenancePanel provenance={company.provenance} />
        </SpecBlock>
      </div>
    </BaseloadSpecPage>
  );
}
