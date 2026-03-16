"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BaseloadSpecPage, SpecBlock } from "@/components/platform/BaseloadSpec";

type EndpointKey =
  | "strategic"
  | "issues"
  | "company"
  | "site"
  | "facility"
  | "missionMap"
  | "asset";

const ENDPOINT_META: Record<EndpointKey, { label: string; path: string; note: string }> = {
  strategic: { label: "Strategic", path: "/api/strategic", note: "capital + infrastructure + clusters" },
  issues: { label: "Issues", path: "/api/issues", note: "rule-triggered contradiction classes" },
  company: { label: "Company", path: "/api/company/[companyId]", note: "sites, programs, investments" },
  site: { label: "Site", path: "/api/site/[siteId]", note: "site facts and freshness" },
  facility: { label: "Facility", path: "/api/facility/[facilityId]", note: "evidence, identity, provenance" },
  missionMap: { label: "Mission Map", path: "/api/mission-map/[facilityId]", note: "layered topology" },
  asset: { label: "Asset", path: "/api/asset/[assetId]", note: "dependency context" },
};

export default function CanonicalExplorerPage() {
  const [companyId, setCompanyId] = useState("intel");
  const [siteId, setSiteId] = useState("demo-gulfchem-houston-complex");
  const [facilityId, setFacilityId] = useState("demo-gulfchem-houston-complex");
  const [assetId, setAssetId] = useState("demo-gulfchem-houston-complex:plc-01");
  const [active, setActive] = useState<EndpointKey>("strategic");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [response, setResponse] = useState<string>("");

  const path = useMemo(() => {
    const template = ENDPOINT_META[active].path;
    return template
      .replace("[companyId]", encodeURIComponent(companyId))
      .replace("[siteId]", encodeURIComponent(siteId))
      .replace("[facilityId]", encodeURIComponent(facilityId))
      .replace("[assetId]", encodeURIComponent(assetId));
  }, [active, companyId, siteId, facilityId, assetId]);

  async function runQuery() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(path);
      setStatus(res.status);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setStatus(0);
      setResponse(
        JSON.stringify(
          { error: "Request failed", detail: error instanceof Error ? error.message : "Unknown error" },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseloadSpecPage
      title="Canonical Explorer"
      subtitle="test the canonical map contract live"
      actions={
        <Link href="/framework" className="spec-link">
          BACK
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <SpecBlock title="Endpoint Console">
          <div className="space-y-2">
            {(Object.keys(ENDPOINT_META) as EndpointKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                  active === key
                    ? "border-lime-300/60 bg-lime-300/10 text-lime-200"
                    : "border-zinc-700 bg-[#090909] text-zinc-200 hover:border-zinc-500"
                }`}
              >
                <div className="spec-body">{ENDPOINT_META[key].label}</div>
                <div className="spec-cell-label mt-1">{ENDPOINT_META[key].path}</div>
                <div className="spec-cell-label mt-1">{ENDPOINT_META[key].note}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <Field label="companyId" value={companyId} onChange={setCompanyId} />
            <Field label="siteId" value={siteId} onChange={setSiteId} />
            <Field label="facilityId" value={facilityId} onChange={setFacilityId} />
            <Field label="assetId" value={assetId} onChange={setAssetId} />
          </div>

          <div className="mt-4 rounded border border-zinc-700 bg-[#090909] px-3 py-2 text-xs text-zinc-300">
            Request: <code>{path}</code>
          </div>

          <button
            type="button"
            onClick={runQuery}
            disabled={loading}
            className="mt-4 w-full rounded border border-lime-300/60 bg-lime-300/10 px-3 py-2 text-sm text-lime-200 hover:bg-lime-300/15 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Run"}
          </button>
        </SpecBlock>

        <SpecBlock title="Response">
          <div className="mb-2 flex items-center justify-between">
            <p className="spec-cell-label">Live canonical payload</p>
            <p className="spec-cell-label">Status: {status === null ? "n/a" : status === 0 ? "error" : status}</p>
          </div>
          <pre className="min-h-[520px] overflow-auto rounded border border-zinc-800 bg-black p-3 text-xs leading-5 text-zinc-200">
            {response || "// Run an endpoint request"}
          </pre>
        </SpecBlock>
      </div>
    </BaseloadSpecPage>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-zinc-700 bg-[#090909] px-2 py-1.5 text-sm text-zinc-100 focus:border-lime-300/60 focus:outline-none"
      />
    </label>
  );
}
