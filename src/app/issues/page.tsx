import Link from "next/link";
import { IssuesPanel } from "@/components/canonical/CanonicalPanels";
import { BaseloadSpecPage, SpecBlock, SpecMetricGrid } from "@/components/platform/BaseloadSpec";
import { getIssueCenter } from "@/lib/canonical/service";

export default async function IssuesPage() {
  const issues = await getIssueCenter();
  const observedAt = issues.map((issue) => issue.observedAt).filter(Boolean) as string[];
  const freshDate = observedAt.sort().at(-1);

  const categoryCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.category] = (acc[issue.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <BaseloadSpecPage
      title="Issue Center"
      subtitle="rule-triggered contradictions + missing structure"
      actions={
        <Link href="/strategic" className="spec-link">
          STRATEGIC
        </Link>
      }
    >
      <SpecBlock title="Issue Summary">
        <SpecMetricGrid
          metrics={[
            ["Open Issues", issues.length.toString()],
            ["Latest Observation", freshDate ? new Date(freshDate).toLocaleDateString("en-US") : "unknown"],
            ["Missing Dependencies", String(categoryCounts.missing_dependency || 0)],
            ["Undocumented Assets", String(categoryCounts.undocumented_asset || 0)],
            ["Documentation Mismatch", String(categoryCounts.documentation_mismatch || 0)],
            ["Topology Contradictions", String(categoryCounts.topology_contradiction || 0)],
          ]}
        />
      </SpecBlock>

      <SpecBlock title="Issue Queue">
        <IssuesPanel issues={issues} />
      </SpecBlock>
    </BaseloadSpecPage>
  );
}
