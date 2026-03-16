import Link from "next/link";
import { BaseloadSpecPage, SpecBlock, SpecDataTable, SpecMetricGrid } from "@/components/platform/BaseloadSpec";

const canonicalObjects = [
  ["Company", "Owner / operator / issuer"],
  ["Site", "Macro location with program and facility scope"],
  ["Facility", "Observed plant or infrastructure node"],
  ["Line", "Optional MVP sub-facility layer"],
  ["Asset", "Detailed operational node"],
  ["Program", "Funding or regulatory anchor"],
];

const doctrineRows = [
  { label: "Observation", value: "source-backed", meta: "evidence first" },
  { label: "Inference", value: "derived", meta: "never promoted to evidence" },
  { label: "Issue", value: "rule-triggered", meta: "contradiction / gap class" },
];

const routeRows = [
  { label: "/api/strategic", value: "Strategic Map", meta: "capital + infrastructure + clusters" },
  { label: "/api/company/[companyId]", value: "Company View", meta: "sites, programs, investments" },
  { label: "/api/site/[siteId]", value: "Site Intelligence", meta: "site facts, facilities, freshness" },
  { label: "/api/facility/[facilityId]", value: "Facility View", meta: "facts, evidence, confidence" },
  { label: "/api/mission-map/[facilityId]", value: "Mission Map", meta: "topology + dependency layers" },
  { label: "/api/asset/[assetId]", value: "Asset Detail", meta: "provenance required" },
  { label: "/api/issues", value: "Issue Center", meta: "missing dependency / mismatch / contradiction" },
];

export default function FrameworkPage() {
  return (
    <BaseloadSpecPage
      title="Canonical System Framework"
      subtitle="strategic map -> site intelligence -> mission map"
      actions={
        <Link href="/framework/canonical-explorer" className="spec-link">
          EXPLORER
        </Link>
      }
    >
      <SpecBlock title="System Goal">
        <p className="spec-body max-w-4xl">
          Build Baseload as one coherent operating system where every screen resolves to canonical objects, provenance,
          confidence, and freshness instead of disconnected dashboards.
        </p>
      </SpecBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Canonical Objects">
          <div className="grid gap-2">
            {canonicalObjects.map(([label, detail]) => (
              <div key={label} className="grid grid-cols-[140px_1fr] gap-3 border border-zinc-700 bg-[#090909] px-3 py-2">
                <div className="spec-cell-value text-base">{label}</div>
                <div className="spec-body">{detail}</div>
              </div>
            ))}
          </div>
        </SpecBlock>

        <SpecBlock title="Epistemic Doctrine">
          <SpecDataTable title="Fact Classes" rows={doctrineRows} />
        </SpecBlock>
      </div>

      <SpecBlock title="Navigation Spine">
        <div className="border border-zinc-700 bg-[#090909] px-4 py-4">
          <p className="spec-title text-2xl sm:text-3xl">
            Strategic Map {"->"} Company {"->"} Site {"->"} Facility {"->"} Mission Map {"->"} Asset
          </p>
        </div>
      </SpecBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        <SpecBlock title="Acceptance Criteria">
          <SpecMetricGrid
            metrics={[
              ["Strategic", "capital + infrastructure"],
              ["Site", "facts + freshness"],
              ["Mission", "topology + confidence"],
              ["Asset", "provenance required"],
              ["Issues", "rule-triggered"],
              ["Graph", "machine-readable"],
            ]}
          />
        </SpecBlock>

        <SpecBlock title="API Contract">
          <SpecDataTable title="Canonical Routes" rows={routeRows} />
        </SpecBlock>
      </div>
    </BaseloadSpecPage>
  );
}
