import {
  isSupabaseServerConfigured,
  supabaseServerFetch,
  supabaseServerFetchAll,
} from "@/lib/platform/supabase-server";
import { canonicalSourceName } from "./source-normalization";
import { isRegionalInfrastructureFacility, isSiteFacility } from "./facility-scope";

type SourceRecordRow = {
  source_system: string;
  source_category: string;
  effective_date: string | null;
};

type EvidenceRow = {
  source_name: string;
  observed_at: string;
  dataset: string;
};

type FacilityRow = {
  id: string;
  geo_id: string | null;
  county_fips: string | null;
  cbsa_code: string | null;
  metadata: {
    source?: string;
    facilityType?: string | null;
    region?: string | null;
  } | null;
};

type InvestmentRow = {
  geo_id: string | null;
  county_fips: string | null;
  cbsa_code: string | null;
  tech_tags: string[] | null;
  sector_naics: string | null;
};

type GeoRow = {
  id: string;
  county_fips: string | null;
  cbsa_code: string | null;
};

type ProjectRow = {
  status: string;
  sector: string | null;
  metadata: {
    source?: string;
    region?: string | null;
    utility?: string | null;
    typeClean?: string | null;
    capacityMw?: number | null;
  } | null;
};

type ProgramLinkRow = {
  program_type: string;
};

type SignalRow = {
  signal_type: string;
};

export interface CoverageSourceHealthItem {
  sourceName: string;
  category: string;
  sourceRecords: number;
  evidenceRecords: number;
  latestObservedAt: string;
  freshness: "fresh" | "aging" | "stale" | "scheduled";
}

export interface CoverageMetricItem {
  label: string;
  value: string;
  note: string;
}

export interface CoverageTagItem {
  label: string;
  count: number;
}

export interface IndustrialTrackerCoverageDashboard {
  mode: "live" | "demo";
  generatedAt: string;
  sourceHealth: CoverageSourceHealthItem[];
  coverageMetrics: CoverageMetricItem[];
  topTechTags: CoverageTagItem[];
  topProjectSectors: CoverageTagItem[];
  topQueueUtilities: CoverageTagItem[];
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function freshnessFromDate(date: string) {
  const target = new Date(date).valueOf();
  const now = Date.now();
  if (target - now > 1000 * 60 * 60 * 24 * 7) return "scheduled";
  const ageMs = now - target;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return "fresh";
  if (ageDays <= 30) return "aging";
  return "stale";
}

function rankCounts(items: Map<string, number>, limit = 8): CoverageTagItem[] {
  return Array.from(items.entries())
    .filter(([label, count]) => Boolean(label) && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function loadIndustrialTrackerCoverageDashboard(): Promise<IndustrialTrackerCoverageDashboard> {
  const generatedAt = new Date().toISOString();

  if (!isSupabaseServerConfigured()) {
    return {
      mode: "demo",
      generatedAt,
      sourceHealth: [
        {
          sourceName: "USAspending",
          category: "federal_award",
          sourceRecords: 50,
          evidenceRecords: 50,
          latestObservedAt: generatedAt,
          freshness: "fresh",
        },
        {
          sourceName: "Queued Up Interconnection Queue",
          category: "energy",
          sourceRecords: 100,
          evidenceRecords: 100,
          latestObservedAt: generatedAt,
          freshness: "fresh",
        },
      ],
      coverageMetrics: [
        { label: "Sites indexed", value: "250", note: "plant and project site rows" },
        { label: "Infrastructure nodes", value: "18", note: "regional grid and utility rows" },
        { label: "County resolved", value: "72%", note: "site geography coverage" },
        { label: "CBSA resolved", value: "31%", note: "site metro coverage" },
        { label: "Queue projects", value: "100", note: "utility/interconnection signals" },
      ],
      topTechTags: [
        { label: "ai_support", count: 6 },
        { label: "major_load", count: 4 },
        { label: "battery", count: 4 },
      ],
      topProjectSectors: [
        { label: "power_infrastructure", count: 12 },
        { label: "ai_infrastructure", count: 4 },
        { label: "grid_infrastructure", count: 4 },
      ],
      topQueueUtilities: [
        { label: "SDGE", count: 16 },
        { label: "Georgia Transmission", count: 12 },
        { label: "PGAE", count: 10 },
      ],
    };
  }

  const [sourceRows, evidenceRows, facilityRows, investmentRows, projectRows, programLinkRows, signalRows, geoRows] =
    await Promise.all([
      supabaseServerFetchAll(
        "source_records?select=source_system,source_category,effective_date&limit=10000"
      ) as Promise<SourceRecordRow[]>,
      supabaseServerFetchAll(
        "evidence_records?select=source_name,observed_at,dataset&limit=10000"
      ) as Promise<EvidenceRow[]>,
      supabaseServerFetchAll(
        "facility_master?select=id,geo_id,county_fips,cbsa_code,metadata&limit=10000"
      ) as Promise<FacilityRow[]>,
      supabaseServerFetchAll(
        "investment_events?select=geo_id,county_fips,cbsa_code,tech_tags,sector_naics&limit=10000"
      ) as Promise<InvestmentRow[]>,
      supabaseServerFetchAll(
        "industrial_projects?select=status,sector,metadata&limit=10000"
      ) as Promise<ProjectRow[]>,
      supabaseServerFetchAll(
        "program_links?select=program_type&limit=10000"
      ) as Promise<ProgramLinkRow[]>,
      supabaseServerFetchAll(
        "derived_signals?select=signal_type&limit=10000"
      ) as Promise<SignalRow[]>,
      supabaseServerFetchAll(
        "geo_dim?select=id,county_fips,cbsa_code&limit=10000"
      ) as Promise<GeoRow[]>,
    ]);

  const geoById = new Map(geoRows.map((row) => [row.id, row]));
  const siteFacilityRows = facilityRows.filter((row) => isSiteFacility(row.metadata));
  const regionalFacilityRows = facilityRows.filter((row) => isRegionalInfrastructureFacility(row.metadata));

  const evidenceBySource = new Map<string, { count: number; latestObservedAt: string }>();
  for (const row of evidenceRows) {
    const canonicalName = canonicalSourceName(row.source_name);
    const current = evidenceBySource.get(canonicalName);
    if (!current) {
      evidenceBySource.set(canonicalName, { count: 1, latestObservedAt: row.observed_at });
      continue;
    }
    current.count += 1;
    if (row.observed_at > current.latestObservedAt) current.latestObservedAt = row.observed_at;
  }

  const sourceRollup = new Map<string, { category: string; count: number; latestObservedAt: string | null }>();
  for (const row of sourceRows) {
    const canonicalName = canonicalSourceName(row.source_system);
    const current = sourceRollup.get(canonicalName);
    if (!current) {
      sourceRollup.set(canonicalName, {
        category: row.source_category,
        count: 1,
        latestObservedAt: row.effective_date,
      });
      continue;
    }
    current.count += 1;
    if (row.effective_date && (!current.latestObservedAt || row.effective_date > current.latestObservedAt)) {
      current.latestObservedAt = row.effective_date;
    }
  }

  const sourceHealth = Array.from(sourceRollup.entries())
    .map(([sourceName, value]) => {
      const evidence = evidenceBySource.get(sourceName);
      const latestObservedAt = evidence?.latestObservedAt || value.latestObservedAt || generatedAt;
      return {
        sourceName,
        category: value.category,
        sourceRecords: value.count,
        evidenceRecords: evidence?.count || 0,
        latestObservedAt,
        freshness: freshnessFromDate(latestObservedAt),
      } satisfies CoverageSourceHealthItem;
    })
    .sort((a, b) => b.sourceRecords - a.sourceRecords)
    .slice(0, 20);

  const facilityCountyResolved = siteFacilityRows.filter((row) => Boolean(row.county_fips || (row.geo_id ? geoById.get(row.geo_id)?.county_fips : null))).length;
  const facilityCbsaResolved = siteFacilityRows.filter((row) => Boolean(row.cbsa_code || (row.geo_id ? geoById.get(row.geo_id)?.cbsa_code : null))).length;
  const facilityTotal = siteFacilityRows.length || 1;
  const investmentCountyResolved = investmentRows.filter((row) => Boolean(row.county_fips || (row.geo_id ? geoById.get(row.geo_id)?.county_fips : null))).length;
  const investmentCbsaResolved = investmentRows.filter((row) => Boolean(row.cbsa_code || (row.geo_id ? geoById.get(row.geo_id)?.cbsa_code : null))).length;
  const queueProjects = projectRows.filter((row) => row.metadata?.source === "Queued Up Interconnection Queue");
  const queuedCapacity = queueProjects.reduce((sum, row) => sum + (Number(row.metadata?.capacityMw) || 0), 0);

  const coverageMetrics: CoverageMetricItem[] = [
    {
      label: "Sites indexed",
      value: formatCount(siteFacilityRows.length),
      note: "plant and project site rows",
    },
    {
      label: "Infrastructure nodes",
      value: formatCount(regionalFacilityRows.length),
      note: "regional grid and utility rows",
    },
    {
      label: "County resolved",
      value: `${Math.round((facilityCountyResolved / facilityTotal) * 100)}%`,
      note: `${formatCount(facilityCountyResolved)} of ${formatCount(siteFacilityRows.length)} sites`,
    },
    {
      label: "CBSA resolved",
      value: `${Math.round((facilityCbsaResolved / facilityTotal) * 100)}%`,
      note: `${formatCount(facilityCbsaResolved)} metro-linked sites`,
    },
    {
      label: "Investment county coverage",
      value: `${Math.round((investmentCountyResolved / Math.max(investmentRows.length, 1)) * 100)}%`,
      note: `${formatCount(investmentCountyResolved)} of ${formatCount(investmentRows.length)} investment rows`,
    },
    {
      label: "Investment CBSA coverage",
      value: `${Math.round((investmentCbsaResolved / Math.max(investmentRows.length, 1)) * 100)}%`,
      note: `${formatCount(investmentCbsaResolved)} metro-linked investment rows`,
    },
    {
      label: "Queue projects",
      value: formatCount(queueProjects.length),
      note: `${formatCount(Math.round(queuedCapacity))} MW requested`,
    },
    {
      label: "Program links",
      value: formatCount(programLinkRows.length),
      note: "registry and program system anchors",
    },
    {
      label: "Derived signals",
      value: formatCount(signalRows.length),
      note: "non-raw graph observations",
    },
  ];

  const techTagCounts = new Map<string, number>();
  for (const row of investmentRows) {
    for (const tag of row.tech_tags || []) {
      techTagCounts.set(tag, (techTagCounts.get(tag) || 0) + 1);
    }
  }

  const projectSectorCounts = new Map<string, number>();
  for (const row of projectRows) {
    const sector = row.sector || row.metadata?.typeClean || row.status;
    if (!sector) continue;
    projectSectorCounts.set(sector, (projectSectorCounts.get(sector) || 0) + 1);
  }

  const queueUtilityCounts = new Map<string, number>();
  for (const row of queueProjects) {
    const utility = row.metadata?.utility;
    if (!utility) continue;
    queueUtilityCounts.set(utility, (queueUtilityCounts.get(utility) || 0) + 1);
  }

  return {
    mode: "live",
    generatedAt,
    sourceHealth,
    coverageMetrics,
    topTechTags: rankCounts(techTagCounts),
    topProjectSectors: rankCounts(projectSectorCounts),
    topQueueUtilities: rankCounts(queueUtilityCounts),
  };
}
