import { loadIndustrialTrackerDashboard } from "@/lib/industrial-tracker/dashboard";
import { isSiteFacility } from "@/lib/industrial-tracker/facility-scope";
import { loadIndustrialTrackerFacilityDetail } from "@/lib/industrial-tracker/facility-detail";
import { isSupabaseServerConfigured, supabaseServerFetchAll } from "@/lib/platform/supabase-server";
import type {
  AssetProfile,
  CanonicalFact,
  CompanyProfile,
  ConfidenceState,
  FacilityProfile,
  FreshnessSummary,
  IssueRecord,
  MissionMapEdge,
  MissionMapNode,
  MissionMapView,
  SiteProfile,
  StrategicView,
} from "@/lib/canonical/types";

type CanonicalEntityRow = {
  id: string;
  legal_name: string;
  normalized_name: string;
  entity_type: string;
  aliases: string[] | null;
  identifiers: Record<string, string | string[] | undefined> | null;
};

type CanonicalFacilityRow = {
  id: string;
  entity_id: string | null;
  facility_name: string;
  normalized_name: string;
  address: {
    city?: string;
    state?: string;
    countyFips?: string;
  } | null;
  county_fips: string | null;
  cbsa_code: string | null;
  geo_id: string | null;
  metadata?: Record<string, unknown> | null;
};

type CanonicalEvidenceRow = {
  id: string;
  facility_id: string | null;
  company_id: string | null;
  source_name: string;
  evidence_type: string;
  observed_at: string;
  dataset: string;
};

type CanonicalFacilityEventRow = {
  id: string;
  facility_id: string | null;
  event_type: string;
  occurred_at: string;
};

type CanonicalProgramLinkRow = {
  id: string;
  facility_id: string;
  program_type: string;
  external_program_id: string;
  agency: string | null;
};

type CanonicalInvestmentRow = {
  id: string;
  facility_id: string | null;
  provider_entity_id: string | null;
  recipient_entity_id: string | null;
  amount: string | null;
  amount_type: string;
  action_date: string | null;
  program_name: string | null;
  recipient_name: string | null;
  tech_tags: string[] | null;
};

type CanonicalProjectRow = {
  id: string;
  facility_id: string | null;
  company_id: string | null;
  project_type: string;
  sector: string | null;
  status: string;
  investment_amount: string | null;
  announcement_date: string | null;
};

type CanonicalSignalRow = {
  id: string;
  facility_id: string | null;
  signal_type: string;
  observed_at: string;
};

type CanonicalGeoRow = {
  id: string;
  county_name: string | null;
  state_code: string | null;
  cbsa_code: string | null;
  cbsa_name: string | null;
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatFacilityGeography(
  facility: Pick<CanonicalFacilityRow, "address" | "county_fips" | "cbsa_code" | "geo_id">,
  geoById: Map<string, CanonicalGeoRow>
) {
  const geo = facility.geo_id ? geoById.get(facility.geo_id) : undefined;
  const city = facility.address?.city;
  const state = facility.address?.state || geo?.state_code;
  if (city || state) {
    return [city, state].filter(Boolean).join(", ");
  }
  if (geo?.county_name || geo?.cbsa_name) {
    return [geo.cbsa_name, geo.county_name, geo.state_code].filter(Boolean).join(" • ");
  }
  return "Unknown geography";
}

function isStrategicEvidenceSource(sourceName: string) {
  const value = sourceName.toLowerCase();
  return [
    "usaspending.gov",
    "empire state development incentives",
    "sec edgar",
    "chips awards",
    "doe edf projects",
    "baseload ",
    "eia",
    "eia grid monitor",
  ].some((token) => value.includes(token));
}

function looksNonIndustrialFacilityName(name: string) {
  const value = normalizeText(name);
  return [
    "inn",
    "cleaners",
    "plane crash",
    "police",
    "village of",
    "city of",
    "forest preserve",
    "school district",
    "school",
    "university",
    "hospital",
    "manhole",
    "road link",
    "satellite",
    "drip",
  ].some((token) => value.includes(token));
}

function isIndustrialIssueCandidate(params: {
  facility: CanonicalFacilityRow;
  evidenceRows: CanonicalEvidenceRow[];
  signalRows: CanonicalSignalRow[];
  programLinks: CanonicalProgramLinkRow[];
  investmentCount: number;
  projectCount: number;
}) {
  const source = String(params.facility.metadata?.source || "").toLowerCase();
  const evidenceSources = new Set(params.evidenceRows.map((row) => row.source_name.toLowerCase()));
  const signalTypes = new Set(params.signalRows.map((row) => row.signal_type));

  const strategicSource =
    source.startsWith("baseload") ||
    source === "eia" ||
    source === "empire state development incentives" ||
    source === "usaspending" ||
    source === "sec edgar";

  const corroboratedEvidence = params.evidenceRows.some((row) => isStrategicEvidenceSource(row.source_name));
  const industrialSignals =
    signalTypes.has("chemical_processing_detected") ||
    signalTypes.has("new_construction_activity") ||
    signalTypes.has("project_momentum_observed") ||
    signalTypes.has("plant_generation_observed") ||
    signalTypes.has("plant_capacity_observed") ||
    signalTypes.has("federal_investment_signal") ||
    signalTypes.has("state_incentive_recorded") ||
    signalTypes.has("issuer_filing_observed") ||
    signalTypes.has("chips_award_announced") ||
    signalTypes.has("doe_financing_announced");

  const strategicEvidenceCount = params.evidenceRows.filter((row) =>
    isStrategicEvidenceSource(row.source_name)
  ).length;
  const nonEpaEvidenceCount = params.evidenceRows.filter(
    (row) => !row.source_name.toLowerCase().includes("epa")
  ).length;
  const namedLikeIndustrial = !looksNonIndustrialFacilityName(params.facility.facility_name);
  const multiAnchorPrograms = params.programLinks.length >= 2;
  const hasCapitalContext = params.investmentCount > 0 || params.projectCount > 0;
  const strongCorroboration =
    strategicSource ||
    strategicEvidenceCount > 0 ||
    hasCapitalContext ||
    industrialSignals ||
    multiAnchorPrograms ||
    nonEpaEvidenceCount >= 2;

  if (!namedLikeIndustrial && !hasCapitalContext && strategicEvidenceCount === 0) {
    return false;
  }

  if (!strongCorroboration) {
    return false;
  }

  const epaOnly =
    evidenceSources.size > 0 &&
    Array.from(evidenceSources).every(
      (sourceName) => sourceName.includes("epa") || sourceName === "queued up interconnection queue"
    );

  if (epaOnly && !hasCapitalContext && !strategicSource && !industrialSignals && !multiAnchorPrograms) {
    return false;
  }

  return (
    params.programLinks.length > 0 ||
    hasCapitalContext ||
    strategicSource ||
    corroboratedEvidence ||
    industrialSignals
  );
}

function parseMoneyToUsd(label: string): number {
  const normalized = label.replace(/[$,\s]/g, "");
  if (!normalized) return 0;
  if (normalized.endsWith("B")) return Number.parseFloat(normalized) * 1_000_000_000;
  if (normalized.endsWith("M")) return Number.parseFloat(normalized) * 1_000_000;
  if (normalized.endsWith("K")) return Number.parseFloat(normalized) * 1_000;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function fallbackIssue(id: string, title: string, facilityId?: string): IssueRecord {
  return {
    id,
    kind: "issue",
    category: "documentation_mismatch",
    title,
    confidence: "inferred",
    facilityId,
    provenance: [{ source: "Baseload synthetic issue rule", reference: "canonical-fallback" }],
  };
}

function buildFreshnessSummary(params: {
  lastObservedAt?: string;
  sourceCount: number;
  confidenceReason: string;
}): FreshnessSummary {
  if (!params.lastObservedAt) {
    return {
      lastObservedAt: undefined,
      freshness: "unknown",
      sourceCount: params.sourceCount,
      confidenceReason: params.confidenceReason,
    };
  }

  const ageMs = Date.now() - new Date(params.lastObservedAt).getTime();
  const freshness = ageMs <= 1000 * 60 * 60 * 24 * 30 ? "fresh" : "stale";

  return {
    lastObservedAt: params.lastObservedAt,
    freshness,
    sourceCount: params.sourceCount,
    confidenceReason: params.confidenceReason,
  };
}

function buildFact(params: {
  id: string;
  kind: CanonicalFact["kind"];
  label: string;
  confidence: ConfidenceState;
  observedAt?: string;
  provenance: CanonicalFact["provenance"];
}): CanonicalFact {
  return {
    id: params.id,
    kind: params.kind,
    label: params.label,
    confidence: params.confidence,
    observedAt: params.observedAt,
    provenance: params.provenance,
  };
}

function confidenceFromSourceCount(sourceCount: number): ConfidenceState {
  if (sourceCount >= 4) return "observed";
  if (sourceCount >= 2) return "inferred";
  return "unknown";
}

function buildDashboardCompanyProfile(
  companyId: string,
  dashboard: Awaited<ReturnType<typeof loadIndustrialTrackerDashboard>>
): CompanyProfile | null {
  const key = companyId.toLowerCase();
  const candidates = dashboard.aiBuildoutItems.filter((item) =>
    slugify(item.facilityName).includes(key)
  );
  if (candidates.length === 0) {
    return null;
  }

  const legalName = candidates[0].facilityName;
  const sites = candidates.map((item) => ({
    siteId: item.facilityId,
    siteName: item.facilityName,
    geography: item.geography,
  }));

  const programs = Array.from(
    new Set(candidates.flatMap((item) => item.tags.map((tag) => String(tag))))
  );
  const provenance = [
    { source: "Industrial Tracker", reference: "aiBuildoutItems", observedAt: dashboard.generatedAt },
  ];
  const facts: CanonicalFact[] = candidates.slice(0, 4).map((item, index) =>
    buildFact({
      id: `company-fact-${companyId}-${index}`,
      kind: "inference",
      label: `${item.facilityName} linked to ${item.tags.join(", ")}`,
      confidence: item.sourceCount && item.sourceCount > 1 ? "observed" : "inferred",
      observedAt: dashboard.generatedAt,
      provenance,
    })
  );

  return {
    companyId,
    legalName,
    sites,
    programs,
    investments: candidates.map((item) => ({
      amountLabel: item.amountLabel,
      sourceTag: "industrial-tracker",
      facilityId: item.facilityId,
    })),
    identity: {
      canonicalId: companyId,
      resolutionBasis: "slug-matched strategic capital candidates",
    },
    facts,
    freshness: buildFreshnessSummary({
      lastObservedAt: dashboard.generatedAt,
      sourceCount: candidates.length,
      confidenceReason: "Derived from current strategic capital and AI buildout evidence.",
    }),
    provenance,
  };
}

export async function getStrategicView(): Promise<StrategicView> {
  const dashboard = await loadIndustrialTrackerDashboard();
  const topSectors = dashboard.aiSummaryItems.map((item) => ({
    label: item.label,
    valueUsd: parseMoneyToUsd(item.amountLabel),
    projectCount: item.count,
  }));

  return {
    generatedAt: dashboard.generatedAt,
    metrics: {
      totalTrackedUsd: dashboard.totalTrackedUsd,
      facilityCount: dashboard.facilityCount,
      infrastructureNodeCount: dashboard.infrastructureNodeCount,
      evidenceCount: dashboard.evidenceCount,
      queueProjectCount: dashboard.queueProjectCount,
    },
    topRegions: dashboard.topCountySummary.rows.map((row) => ({
      id: slugify(row.geographyLabel),
      label: row.geographyLabel,
      totalAmountUsd: row.totalAmountUsd,
      eventCount: row.eventCount,
      permitEventCount: row.permitEventCount,
    })),
    topSectors,
  };
}

export async function getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  if (!isSupabaseServerConfigured()) {
    const dashboard = await loadIndustrialTrackerDashboard();
    return buildDashboardCompanyProfile(companyId, dashboard);
  }

  const [entities, facilities, evidenceRows, eventRows, programLinkRows, investmentRows, projectRows, geoRows] =
    await Promise.all([
      supabaseServerFetchAll<CanonicalEntityRow>(
        "entity_master?select=id,legal_name,normalized_name,entity_type,aliases,identifiers"
      ),
      supabaseServerFetchAll<CanonicalFacilityRow>(
        "facility_master?select=id,entity_id,facility_name,normalized_name,address,county_fips,cbsa_code,geo_id,metadata"
      ),
      supabaseServerFetchAll<CanonicalEvidenceRow>(
        "evidence_records?select=id,facility_id,company_id,source_name,evidence_type,observed_at,dataset"
      ),
      supabaseServerFetchAll<CanonicalFacilityEventRow>(
        "facility_events?select=id,facility_id,event_type,occurred_at"
      ),
      supabaseServerFetchAll<CanonicalProgramLinkRow>(
        "program_links?select=id,facility_id,program_type,external_program_id,agency"
      ),
      supabaseServerFetchAll<CanonicalInvestmentRow>(
        "investment_events?select=id,facility_id,provider_entity_id,recipient_entity_id,amount,amount_type,action_date,program_name,recipient_name,tech_tags"
      ),
      supabaseServerFetchAll<CanonicalProjectRow>(
        "industrial_projects?select=id,facility_id,company_id,project_type,sector,status,investment_amount,announcement_date"
      ),
      supabaseServerFetchAll<CanonicalGeoRow>(
        "geo_dim?select=id,county_name,state_code,cbsa_code,cbsa_name"
      ),
    ]);

  const query = normalizeText(companyId);
  const geoById = new Map(geoRows.map((row) => [row.id, row]));
  const facilitiesByEntity = new Map<string, CanonicalFacilityRow[]>();
  for (const facility of facilities) {
    if (!facility.entity_id) continue;
    const bucket = facilitiesByEntity.get(facility.entity_id) || [];
    bucket.push(facility);
    facilitiesByEntity.set(facility.entity_id, bucket);
  }

  let matchedEntity: CanonicalEntityRow | undefined;
  if (isUuid(companyId)) {
    matchedEntity = entities.find((entity) => entity.id === companyId);
  } else {
    const scored = entities
      .map((entity) => {
        let score = 0;
        if (slugify(entity.legal_name) === companyId) score += 100;
        if (entity.normalized_name === query) score += 90;
        if (entity.normalized_name.includes(query)) score += 40;
        if ((entity.aliases || []).some((alias) => slugify(alias) === companyId)) score += 75;
        if ((entity.aliases || []).some((alias) => normalizeText(alias).includes(query))) score += 30;

        const relatedFacilities = facilitiesByEntity.get(entity.id) || [];
        if (relatedFacilities.some((facility) => slugify(facility.facility_name) === companyId)) score += 80;
        if (relatedFacilities.some((facility) => facility.normalized_name.includes(query))) score += 50;
        if (
          relatedFacilities.some((facility) =>
            normalizeText([facility.address?.city, facility.address?.state].filter(Boolean).join(" ")).includes(query)
          )
        ) {
          score += 15;
        }
        return { entity, score, relatedFacilities };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    matchedEntity = scored[0]?.entity;
  }

  if (!matchedEntity) {
    const dashboard = await loadIndustrialTrackerDashboard();
    return buildDashboardCompanyProfile(companyId, dashboard);
  }

  const entityFacilities = (facilitiesByEntity.get(matchedEntity.id) || []).filter((facility) =>
    isSiteFacility(facility.metadata)
  );
  const facilityIds = new Set(entityFacilities.map((facility) => facility.id));
  const companyEvidence = evidenceRows.filter(
    (row) => row.company_id === matchedEntity!.id || (row.facility_id && facilityIds.has(row.facility_id))
  );
  const companyEvents = eventRows.filter(
    (row) => row.facility_id && facilityIds.has(row.facility_id)
  );
  const companyPrograms = programLinkRows.filter((row) => facilityIds.has(row.facility_id));
  const companyInvestments = investmentRows.filter(
    (row) =>
      row.recipient_entity_id === matchedEntity!.id ||
      row.provider_entity_id === matchedEntity!.id ||
      (row.facility_id && facilityIds.has(row.facility_id))
  );
  const companyProjects = projectRows.filter(
    (row) => row.company_id === matchedEntity!.id || (row.facility_id && facilityIds.has(row.facility_id))
  );

  const latestObservedAt = [
    ...companyEvidence.map((row) => row.observed_at),
    ...companyEvents.map((row) => row.occurred_at),
    ...companyInvestments.map((row) => row.action_date).filter(Boolean) as string[],
    ...companyProjects.map((row) => row.announcement_date).filter(Boolean) as string[],
  ]
    .filter(Boolean)
    .sort()
    .at(-1);

  const provenance = companyEvidence.slice(0, 6).map((row) => ({
    source: row.source_name,
    reference: row.id,
    observedAt: row.observed_at,
  }));

  const facts: CanonicalFact[] = [
    ...companyEvidence.slice(0, 3).map((row, index) =>
      buildFact({
        id: `company-observation-${matchedEntity!.id}-${index}`,
        kind: "observation",
        label: `${row.evidence_type.replace(/_/g, " ")} from ${row.dataset}`,
        confidence: "observed",
        observedAt: row.observed_at,
        provenance: [
          {
            source: row.source_name,
            reference: row.id,
            observedAt: row.observed_at,
          },
        ],
      })
    ),
    ...companyProjects.slice(0, 2).map((row, index) =>
      buildFact({
        id: `company-inference-${matchedEntity!.id}-${index}`,
        kind: "inference",
        label: `${row.project_type.replace(/_/g, " ")} • ${row.status}`,
        confidence: row.investment_amount ? "observed" : "inferred",
        observedAt: row.announcement_date || latestObservedAt,
        provenance,
      })
    ),
  ];

  return {
    companyId: matchedEntity.id,
    legalName: matchedEntity.legal_name,
    sites: entityFacilities.map((facility) => ({
      siteId: facility.id,
      siteName: facility.facility_name,
      geography: formatFacilityGeography(facility, geoById),
    })),
    programs: Array.from(new Set(companyPrograms.map((row) => row.program_type))).sort(),
    investments: companyInvestments.slice(0, 8).map((row) => ({
      amountLabel: row.amount ? `$${Number(row.amount).toLocaleString()}` : row.program_name || "Observed",
      sourceTag: row.program_name || row.amount_type,
      facilityId: row.facility_id || entityFacilities[0]?.id || matchedEntity!.id,
    })),
    identity: {
      canonicalId: matchedEntity.id,
      resolutionBasis:
        entityFacilities.length > 0
          ? "resolved through entity + linked facility graph"
          : "resolved directly from canonical entity registry",
    },
    facts,
    freshness: buildFreshnessSummary({
      lastObservedAt: latestObservedAt,
      sourceCount: new Set(provenance.map((item) => `${item.source}:${item.reference}`)).size || 1,
      confidenceReason:
        entityFacilities.length > 0
          ? "Entity is supported by linked facilities, evidence, and capital/project records."
          : "Entity matched directly, but facility linkage is still thin.",
    }),
    provenance:
      provenance.length > 0
        ? provenance
        : [{ source: "Canonical entity registry", reference: matchedEntity.id }],
  };
}

export async function getSiteProfile(siteId: string): Promise<SiteProfile | null> {
  const detail = await loadIndustrialTrackerFacilityDetail(siteId);
  if (!detail) return null;

  const provenance = detail.evidenceTimeline.slice(0, 3).map((item) => ({
    source: item.sourceName,
    reference: item.id,
    observedAt: item.observedAt,
  }));

  return {
    siteId,
    companyId: slugify(detail.companyName || detail.facilityName),
    siteName: detail.facilityName,
    geography: detail.geography,
    facilities: [{ facilityId: detail.facilityId, facilityName: detail.facilityName }],
    programs: detail.programLinks.map((p) => p.programType),
    investments: detail.eventTimeline.slice(0, 5).map((evt) => ({
      amountLabel: "Observed",
      status: evt.eventType,
      sourceTag: "facility-events",
    })),
    identity: {
      canonicalId: siteId,
      sourceIds: detail.sourceIds,
      resolutionBasis: "facility-detail joined through canonical facility spine",
    },
    facts: [
      ...detail.evidenceTimeline.slice(0, 3).map((item, index) =>
        buildFact({
          id: `site-observation-${siteId}-${index}`,
          kind: "observation",
          label: item.evidenceType.replace(/_/g, " "),
          confidence: "observed",
          observedAt: item.observedAt,
          provenance: [
            {
              source: item.sourceName,
              reference: item.id,
              observedAt: item.observedAt,
            },
          ],
        })
      ),
      ...detail.eventTimeline.slice(0, 2).map((item, index) =>
        buildFact({
          id: `site-inference-${siteId}-${index}`,
          kind: "inference",
          label: item.eventType.replace(/_/g, " "),
          confidence: detail.programLinks.length > 0 ? "inferred" : "unknown",
          observedAt: item.occurredAt,
          provenance,
        })
      ),
    ],
    freshness: buildFreshnessSummary({
      lastObservedAt: detail.latestObservedAt,
      sourceCount: provenance.length,
      confidenceReason: detail.programLinks.length > 0 ? "Multiple program links support site-level continuity." : "Single-source site evidence only.",
    }),
    provenance,
  };
}

export async function getFacilityProfile(facilityId: string): Promise<FacilityProfile | null> {
  const detail = await loadIndustrialTrackerFacilityDetail(facilityId);
  if (!detail) return null;

  const provenance = detail.evidenceTimeline.slice(0, 6).map((item) => ({
    source: item.sourceName,
    reference: item.id,
    observedAt: item.observedAt,
  }));

  return {
    facilityId: detail.facilityId,
    facilityName: detail.facilityName,
    geography: detail.geography,
    companyName: detail.companyName,
    latestEvidenceType: detail.latestEvidenceType,
    latestEventType: detail.latestEventType,
    latestObservedAt: detail.latestObservedAt,
    programLinks: detail.programLinks,
    evidenceTimeline: detail.evidenceTimeline,
    eventTimeline: detail.eventTimeline,
    identity: {
      canonicalId: detail.facilityId,
      sourceIds: detail.sourceIds,
      resolutionBasis: Object.keys(detail.sourceIds).length > 0 ? "resolved via source-authored facility identifiers" : "resolved via facility graph linkage",
    },
    facts: [
      ...detail.evidenceTimeline.slice(0, 4).map((item, index) =>
        buildFact({
          id: `facility-observation-${facilityId}-${index}`,
          kind: "observation",
          label: item.evidenceType.replace(/_/g, " "),
          confidence: "observed",
          observedAt: item.observedAt,
          provenance: [
            {
              source: item.sourceName,
              reference: item.id,
              observedAt: item.observedAt,
            },
          ],
        })
      ),
      ...detail.eventTimeline.slice(0, 3).map((item, index) =>
        buildFact({
          id: `facility-inference-${facilityId}-${index}`,
          kind: "inference",
          label: item.eventType.replace(/_/g, " "),
          confidence: detail.programLinks.length > 0 ? "inferred" : "unknown",
          observedAt: item.occurredAt,
          provenance,
        })
      ),
    ],
    freshness: buildFreshnessSummary({
      lastObservedAt: detail.latestObservedAt,
      sourceCount: provenance.length,
      confidenceReason: detail.programLinks.length > 0 ? "Facility has corroborating program links and evidence history." : "Facility currently relies on limited observed evidence.",
    }),
    provenance,
  };
}

export async function getMissionMapView(facilityId: string): Promise<MissionMapView | null> {
  const detail = await loadIndustrialTrackerFacilityDetail(facilityId);
  if (!detail) return null;

  const evidenceCount = detail.evidenceTimeline.length;
  const programCount = detail.programLinks.length;
  const sourceCount = Math.max(1, Math.min(10, evidenceCount + programCount));
  const hasLineStructure = evidenceCount >= 4;
  const lineSourceCount = hasLineStructure ? Math.max(2, Math.floor(sourceCount / 2)) : 1;

  const siteNodeId = `site-${facilityId}`;
  const facilityNodeId = `facility-${facilityId}`;
  const lineNodeId = `line-${facilityId}-a`;
  const processAssetNodeId = `asset-${facilityId}-process`;
  const controlNodeId = `control-${facilityId}-plc`;
  const networkNodeId = `network-${facilityId}-core`;
  const dependencyNodeId = `asset-${facilityId}-power-feed`;

  const nodes: MissionMapNode[] = [
    {
      id: siteNodeId,
      label: "Site Envelope",
      nodeType: "site",
      confidence: confidenceFromSourceCount(sourceCount),
      kind: "inference",
      level: 0,
      sourceCount,
      lastObservedAt: detail.latestObservedAt,
    },
    {
      id: facilityNodeId,
      label: detail.facilityName,
      nodeType: "facility",
      confidence: confidenceFromSourceCount(sourceCount),
      kind: "observation",
      level: 1,
      sourceCount,
      parentId: siteNodeId,
      lastObservedAt: detail.latestObservedAt,
    },
    ...(hasLineStructure
      ? [
          {
            id: lineNodeId,
            label: "Line A",
            nodeType: "line" as const,
            confidence: confidenceFromSourceCount(lineSourceCount),
            kind: "inference" as const,
            level: 2,
            sourceCount: lineSourceCount,
            parentId: facilityNodeId,
            lastObservedAt: detail.latestObservedAt,
          },
        ]
      : []),
    {
      id: processAssetNodeId,
      label: "Process Asset Cluster",
      nodeType: "asset",
      confidence: confidenceFromSourceCount(Math.max(1, Math.floor(sourceCount / 2))),
      kind: "inference",
      level: hasLineStructure ? 3 : 2,
      sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
      parentId: hasLineStructure ? lineNodeId : facilityNodeId,
      lastObservedAt: detail.latestObservedAt,
    },
    {
      id: controlNodeId,
      label: "PLC Cluster",
      nodeType: "control",
      confidence: confidenceFromSourceCount(Math.max(1, Math.floor(sourceCount / 2))),
      kind: "inference",
      level: hasLineStructure ? 3 : 2,
      sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
      parentId: hasLineStructure ? lineNodeId : facilityNodeId,
      lastObservedAt: detail.latestObservedAt,
    },
    {
      id: networkNodeId,
      label: "Core OT Network",
      nodeType: "network",
      confidence: confidenceFromSourceCount(Math.max(1, Math.floor(sourceCount / 2))),
      kind: "inference",
      level: hasLineStructure ? 3 : 2,
      sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
      parentId: hasLineStructure ? lineNodeId : facilityNodeId,
      lastObservedAt: detail.latestObservedAt,
    },
    {
      id: dependencyNodeId,
      label: "Power Feed Dependency",
      nodeType: "asset",
      confidence: confidenceFromSourceCount(1),
      kind: "inference",
      level: hasLineStructure ? 4 : 3,
      sourceCount: 1,
      parentId: processAssetNodeId,
      lastObservedAt: detail.latestObservedAt,
    },
  ];

  const edgeConfidence = confidenceFromSourceCount(Math.max(1, Math.floor(sourceCount / 2)));
  const edges: MissionMapEdge[] = [
    {
      id: `edge-site-fac-${facilityId}`,
      from: siteNodeId,
      to: facilityNodeId,
      edgeType: "contains",
      confidence: confidenceFromSourceCount(sourceCount),
      kind: "observation",
      sourceCount,
      lastObservedAt: detail.latestObservedAt,
    },
    ...(hasLineStructure
      ? [
          {
            id: `edge-fac-line-${facilityId}`,
            from: facilityNodeId,
            to: lineNodeId,
            edgeType: "contains" as const,
            confidence: confidenceFromSourceCount(lineSourceCount),
            kind: "inference" as const,
            sourceCount: lineSourceCount,
            lastObservedAt: detail.latestObservedAt,
          },
          {
            id: `edge-line-asset-${facilityId}`,
            from: lineNodeId,
            to: processAssetNodeId,
            edgeType: "contains" as const,
            confidence: edgeConfidence,
            kind: "inference" as const,
            sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
            lastObservedAt: detail.latestObservedAt,
          },
          {
            id: `edge-line-control-${facilityId}`,
            from: lineNodeId,
            to: controlNodeId,
            edgeType: "controlled_by" as const,
            confidence: edgeConfidence,
            kind: "inference" as const,
            sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
            lastObservedAt: detail.latestObservedAt,
          },
        ]
      : [
          {
            id: `edge-fac-asset-${facilityId}`,
            from: facilityNodeId,
            to: processAssetNodeId,
            edgeType: "contains" as const,
            confidence: edgeConfidence,
            kind: "inference" as const,
            sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
            lastObservedAt: detail.latestObservedAt,
          },
          {
            id: `edge-fac-control-${facilityId}`,
            from: facilityNodeId,
            to: controlNodeId,
            edgeType: "controlled_by" as const,
            confidence: edgeConfidence,
            kind: "inference" as const,
            sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
            lastObservedAt: detail.latestObservedAt,
          },
        ]),
    {
      id: `edge-control-net-${facilityId}`,
      from: controlNodeId,
      to: networkNodeId,
      edgeType: "connected_to",
      confidence: edgeConfidence,
      kind: "inference",
      sourceCount: Math.max(1, Math.floor(sourceCount / 2)),
      lastObservedAt: detail.latestObservedAt,
    },
    {
      id: `edge-asset-dependency-${facilityId}`,
      from: processAssetNodeId,
      to: dependencyNodeId,
      edgeType: "depends_on",
      confidence: "inferred",
      kind: "inference",
      sourceCount: 1,
      lastObservedAt: detail.latestObservedAt,
    },
  ];

  const provenance = detail.evidenceTimeline.slice(0, 4).map((item) => ({
    source: item.sourceName,
    reference: item.id,
    observedAt: item.observedAt,
  }));

  return {
    facilityId,
    layers: ["physical", "control", "network", "dependency", "confidence"],
    nodes,
    edges,
    facts: [
      ...detail.evidenceTimeline.slice(0, 2).map((item, index) =>
        buildFact({
          id: `mission-observation-${facilityId}-${index}`,
          kind: "observation",
          label: item.evidenceType.replace(/_/g, " "),
          confidence: "observed",
          observedAt: item.observedAt,
          provenance: [{ source: item.sourceName, reference: item.id, observedAt: item.observedAt }],
        })
      ),
      buildFact({
        id: `mission-inference-${facilityId}`,
        kind: "inference",
        label: hasLineStructure
          ? "line structure inferred with asset/control/network segmentation"
          : "facility-level topology inferred without line segmentation",
        confidence: hasLineStructure ? "inferred" : confidenceFromSourceCount(1),
        observedAt: detail.latestObservedAt,
        provenance,
      }),
    ],
    freshness: buildFreshnessSummary({
      lastObservedAt: detail.latestObservedAt,
      sourceCount: provenance.length,
      confidenceReason: hasLineStructure ? "Line layer supported by multiple facility observations." : "Mission map inferred at facility scope only; line layer omitted in MVP.",
    }),
    provenance,
  };
}

export async function getAssetProfile(assetId: string): Promise<AssetProfile> {
  const [facilityIdRaw] = assetId.split(":");
  const facilityId = facilityIdRaw || "unknown-facility";
  const detail = await loadIndustrialTrackerFacilityDetail(facilityId);

  return {
    assetId,
    assetName: `Asset ${assetId}`,
    assetType: "industrial-control-asset",
    facilityId,
    facilityName: detail?.facilityName || "Unknown facility",
    confidence: detail ? "inferred" : "unknown",
    dependencyContext: ["power", "control network", "operator workflow"],
    facts: detail
      ? [
          buildFact({
            id: `asset-inference-${assetId}`,
            kind: "inference",
            label: "asset placeholder inferred from facility mission context",
            confidence: "inferred",
            observedAt: detail.latestObservedAt,
            provenance: detail.evidenceTimeline.slice(0, 2).map((item) => ({
              source: item.sourceName,
              reference: item.id,
              observedAt: item.observedAt,
            })),
          }),
        ]
      : [
          buildFact({
            id: `asset-unknown-${assetId}`,
            kind: "inference",
            label: "asset context unavailable",
            confidence: "unknown",
            provenance: [{ source: "Baseload synthetic asset profile", reference: "asset-fallback" }],
          }),
        ],
    freshness: buildFreshnessSummary({
      lastObservedAt: detail?.latestObservedAt,
      sourceCount: detail ? Math.min(detail.evidenceTimeline.length, 2) : 1,
      confidenceReason: detail ? "Asset is inferred from facility-level mission context, not directly observed." : "No facility evidence was available for this asset request.",
    }),
    provenance: detail
      ? detail.evidenceTimeline.slice(0, 3).map((item) => ({
          source: item.sourceName,
          reference: item.id,
          observedAt: item.observedAt,
        }))
      : [{ source: "Baseload synthetic asset profile", reference: "asset-fallback" }],
  };
}

export async function getIssueCenter(): Promise<IssueRecord[]> {
  if (!isSupabaseServerConfigured()) {
    const dashboard = await loadIndustrialTrackerDashboard();
    const timeline = dashboard.facilityTimeline || [];

    if (timeline.length === 0) {
      return [fallbackIssue("issue-fallback-1", "No facility timeline available for contradiction scanning")];
    }

    return timeline.slice(0, 6).map((item, index) => {
      const category =
        index % 4 === 0
          ? "missing_dependency"
          : index % 4 === 1
            ? "undocumented_asset"
            : index % 4 === 2
              ? "documentation_mismatch"
              : "topology_contradiction";

      return {
        id: `issue-${item.facilityId}-${index}`,
        kind: "issue",
        category,
        title: `${item.facilityName}: ${item.latestEventType || "signal mismatch"}`,
        confidence: item.programTypes.length > 0 ? "inferred" : "unknown",
        facilityId: item.facilityId,
        observedAt: item.latestObservedAt,
        provenance: [
          {
            source: item.sourceTag,
            reference: `${item.facilityId}-${item.latestObservedAt}`,
            observedAt: item.latestObservedAt,
          },
        ],
      };
    });
  }

  const [facilities, evidenceRows, eventRows, signalRows, programLinkRows, investmentRows, projectRows] = await Promise.all([
    supabaseServerFetchAll<CanonicalFacilityRow>(
      "facility_master?select=id,entity_id,facility_name,normalized_name,address,county_fips,cbsa_code,geo_id,metadata"
    ),
    supabaseServerFetchAll<CanonicalEvidenceRow>(
      "evidence_records?select=id,facility_id,company_id,source_name,evidence_type,observed_at,dataset"
    ),
    supabaseServerFetchAll<CanonicalFacilityEventRow>(
      "facility_events?select=id,facility_id,event_type,occurred_at"
    ),
    supabaseServerFetchAll<CanonicalSignalRow>(
      "derived_signals?select=id,facility_id,signal_type,observed_at"
    ),
    supabaseServerFetchAll<CanonicalProgramLinkRow>(
      "program_links?select=id,facility_id,program_type,external_program_id,agency"
    ),
    supabaseServerFetchAll<CanonicalInvestmentRow>(
      "investment_events?select=id,facility_id,provider_entity_id,recipient_entity_id,amount,amount_type,action_date,program_name,recipient_name,tech_tags"
    ),
    supabaseServerFetchAll<CanonicalProjectRow>(
      "industrial_projects?select=id,facility_id,company_id,project_type,sector,status,investment_amount,announcement_date"
    ),
  ]);

  const siteFacilities = facilities.filter((facility) => isSiteFacility(facility.metadata));
  const issues: IssueRecord[] = [];

  for (const facility of siteFacilities) {
    const facilityEvidence = evidenceRows.filter((row) => row.facility_id === facility.id);
    const facilityEvents = eventRows.filter((row) => row.facility_id === facility.id);
    const facilitySignals = signalRows.filter((row) => row.facility_id === facility.id);
    const facilityPrograms = programLinkRows.filter((row) => row.facility_id === facility.id);
    const facilityInvestments = investmentRows.filter((row) => row.facility_id === facility.id);
    const facilityProjects = projectRows.filter((row) => row.facility_id === facility.id);
    const nonQueueEvidence = facilityEvidence.filter(
      (row) => row.source_name.toLowerCase() !== "queued up interconnection queue"
    );
    const nonQueueSignals = facilitySignals.filter(
      (row) => row.signal_type !== "interconnection_capacity_requested"
    );

    const latestEvidenceAt = facilityEvidence.map((row) => row.observed_at).sort().at(-1);
    const latestEventAt = facilityEvents.map((row) => row.occurred_at).sort().at(-1);
    const latestSignalAt = facilitySignals.map((row) => row.observed_at).sort().at(-1);
    const latestObservedAt = [latestEvidenceAt, latestEventAt, latestSignalAt].filter(Boolean).sort().at(-1);
    const latestObservedMs = latestObservedAt ? new Date(latestObservedAt).getTime() : 0;
    const isFutureOnly = latestObservedMs > Date.now();

    const activeSignalSet = new Set(nonQueueSignals.map((row) => row.signal_type));
    const strategicEvidenceCount = nonQueueEvidence.filter((row) =>
      isStrategicEvidenceSource(row.source_name)
    ).length;
    const strategicFacilitySource = isStrategicEvidenceSource(String(facility.metadata?.source || ""));
    const hasCapitalContext = facilityInvestments.length > 0 || facilityProjects.length > 0;
    const hasStrategicCorroboration =
      strategicEvidenceCount > 0 ||
      strategicFacilitySource ||
      hasCapitalContext ||
      activeSignalSet.has("plant_generation_observed") ||
      activeSignalSet.has("plant_capacity_observed") ||
      activeSignalSet.has("federal_investment_signal") ||
      activeSignalSet.has("state_incentive_recorded") ||
      activeSignalSet.has("chips_award_announced") ||
      activeSignalSet.has("doe_financing_announced");
    const provenance = [
      ...facilityEvidence.slice(0, 2).map((row) => ({
        source: row.source_name,
        reference: row.id,
        observedAt: row.observed_at,
      })),
      ...facilityPrograms.slice(0, 1).map((row) => ({
        source: row.agency || "Program link",
        reference: row.external_program_id,
      })),
    ];

    const hasObservedOperationalContext =
      nonQueueEvidence.length > 0 || facilityEvents.length > 0 || facilityPrograms.length > 0;
    const isIndustrialCandidate = isIndustrialIssueCandidate({
      facility,
      evidenceRows: nonQueueEvidence,
      signalRows: nonQueueSignals,
      programLinks: facilityPrograms,
      investmentCount: facilityInvestments.length,
      projectCount: facilityProjects.length,
    });

    if (isFutureOnly || !hasObservedOperationalContext || !isIndustrialCandidate) {
      continue;
    }

    if ((facilityEvidence.length > 0 || facilityEvents.length > 0) && facilityPrograms.length === 0) {
      issues.push({
        id: `issue-missing-dependency-${facility.id}`,
        kind: "issue",
        category: "missing_dependency",
        title: `${facility.facility_name}: active evidence without regulatory or system anchors`,
        confidence: facilityEvidence.length >= 2 ? "observed" : "inferred",
        facilityId: facility.id,
        observedAt: latestObservedAt,
        provenance,
      });
    }

    if (
      (activeSignalSet.has("chemical_processing_detected") ||
        activeSignalSet.has("new_construction_activity") ||
        activeSignalSet.has("project_momentum_observed")) &&
      facilityEvidence.length <= 1
    ) {
      issues.push({
        id: `issue-undocumented-asset-${facility.id}`,
        kind: "issue",
        category: "undocumented_asset",
        title: `${facility.facility_name}: operational signal without asset-level documentation`,
        confidence: "inferred",
        facilityId: facility.id,
        observedAt: latestObservedAt,
        provenance,
      });
    }

    if (latestEventAt && (!latestEvidenceAt || new Date(latestEventAt).getTime() - new Date(latestEvidenceAt).getTime() > 1000 * 60 * 60 * 24 * 14)) {
      issues.push({
        id: `issue-doc-mismatch-${facility.id}`,
        kind: "issue",
        category: "documentation_mismatch",
        title: `${facility.facility_name}: event activity outpaces supporting observation`,
        confidence: latestEvidenceAt ? "inferred" : "observed",
        facilityId: facility.id,
        observedAt: latestEventAt,
        provenance,
      });
    }

    if (
      (nonQueueEvidence.length > 0 || facilityEvents.length > 0) &&
      !facility.county_fips &&
      !facility.cbsa_code &&
      hasStrategicCorroboration
    ) {
      issues.push({
        id: `issue-topology-${facility.id}`,
        kind: "issue",
        category: "topology_contradiction",
        title: `${facility.facility_name}: active site lacks mapped county or metro geography`,
        confidence: "observed",
        facilityId: facility.id,
        observedAt: latestObservedAt,
        provenance,
      });
    }
  }

  if (issues.length === 0) {
    return [fallbackIssue("issue-fallback-1", "No rule-triggered contradictions were generated from the current graph")];
  }

  return issues
    .sort((a, b) => (b.observedAt || "").localeCompare(a.observedAt || ""))
    .slice(0, 24);
}
