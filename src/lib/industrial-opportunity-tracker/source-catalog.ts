export interface IndustrialOpportunitySourceDefinition {
  id: string;
  systemOfRecord: string;
  category:
    | "federal_awards"
    | "federal_entities"
    | "federal_opportunities"
    | "state_incentives"
    | "permits"
    | "energy"
    | "trade"
    | "logistics"
    | "corporate_filings"
    | "discovery";
  priority: number;
  reliability: "high" | "medium-high" | "medium" | "medium-low";
  cadence: string;
  accessMethod: string;
  primaryUse: string;
  notes: string[];
}

export const INDUSTRIAL_OPPORTUNITY_TRACKER_ID = "industrial-opportunity-tracker";
export const INDUSTRIAL_OPPORTUNITY_TRACKER_NAME = "Opportunity Tracker";

export const industrialOpportunitySourceCatalog: IndustrialOpportunitySourceDefinition[] = [
  {
    id: "usaspending",
    systemOfRecord: "USAspending.gov",
    category: "federal_awards",
    priority: 1,
    reliability: "high",
    cadence: "daily",
    accessMethod: "API + bulk downloads",
    primaryUse: "Authoritative federal obligations, outlays, recipients, place-of-performance, NAICS, and PSC fields.",
    notes: [
      "Primary spine for federal dollar attribution.",
      "Use action date and amount_type separately.",
    ],
  },
  {
    id: "sam",
    systemOfRecord: "SAM.gov / Open.GSA",
    category: "federal_entities",
    priority: 2,
    reliability: "medium-high",
    cadence: "daily",
    accessMethod: "Public APIs",
    primaryUse: "UEI entity spine, opportunities, and subaward context.",
    notes: [
      "UEI should be the canonical federal recipient identifier.",
      "Treat notices as pre-award signals, not awarded dollars.",
    ],
  },
  {
    id: "grants",
    systemOfRecord: "Grants.gov",
    category: "federal_opportunities",
    priority: 3,
    reliability: "medium",
    cadence: "program-dependent",
    accessMethod: "REST APIs",
    primaryUse: "Forward-looking grant and forecast pipeline.",
    notes: [
      "Useful for watchlists and pipeline forecasts.",
      "Actual awarded dollars should reconcile later to USAspending or agency sources.",
    ],
  },
  {
    id: "epa",
    systemOfRecord: "EPA ECHO / RCRAInfo / FRS",
    category: "permits",
    priority: 4,
    reliability: "medium-high",
    cadence: "weekly",
    accessMethod: "Bulk downloads + APIs",
    primaryUse: "Facility master data, permitting, compliance, and validation signals.",
    notes: [
      "Use FRS as the preferred cross-program facility spine where available.",
      "Permits are validation signals, not dollar events.",
    ],
  },
  {
    id: "eia",
    systemOfRecord: "U.S. Energy Information Administration",
    category: "energy",
    priority: 5,
    reliability: "medium-high",
    cadence: "monthly / annual",
    accessMethod: "API + dataset downloads",
    primaryUse: "Energy feasibility, plant context, generator and operations data.",
    notes: [
      "Use EIA plant identifiers as secondary facility keys.",
      "Supports infrastructure and capacity overlays.",
    ],
  },
  {
    id: "sec-edgar",
    systemOfRecord: "SEC EDGAR / data.sec.gov",
    category: "corporate_filings",
    priority: 6,
    reliability: "medium",
    cadence: "continuous",
    accessMethod: "REST APIs",
    primaryUse: "Corporate corroboration, capex context, issuer metadata, and filing timestamps.",
    notes: [
      "Use CIK as the canonical issuer identifier.",
      "Observe SEC fair-access throttling guidance.",
    ],
  },
  {
    id: "private-capital-feed",
    systemOfRecord: "Baseload private capital market feed",
    category: "discovery",
    priority: 7,
    reliability: "medium",
    cadence: "daily",
    accessMethod: "Structured JSON feeds (file or URL)",
    primaryUse: "Private capex, strategic facility expansion, and non-federal capital commitments.",
    notes: [
      "Designed for private capital signals not covered by federal award systems.",
      "Use with source provenance and confidence metadata.",
    ],
  },
  {
    id: "census-trade",
    systemOfRecord: "U.S. Census International Trade API",
    category: "trade",
    priority: 8,
    reliability: "medium",
    cadence: "monthly",
    accessMethod: "Public API",
    primaryUse: "Trade-flow overlays by state, port, district, and commodity.",
    notes: [
      "Best for supply-chain overlays rather than direct funding attribution.",
    ],
  },
  {
    id: "permitting-dashboard",
    systemOfRecord: "Federal Permitting Dashboard",
    category: "permits",
    priority: 9,
    reliability: "medium-high",
    cadence: "periodic",
    accessMethod: "Downloadable datasets",
    primaryUse: "FAST-41 and major-project milestone timelines.",
    notes: [
      "High-value validation layer for major industrial projects.",
    ],
  },
];

export function getIndustrialOpportunityTrackerOverview() {
  return {
    trackerId: INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
    trackerName: INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
    apiNamespace: "/api/industrial-opportunity-tracker",
    canonicalObjects: [
      "entity_master",
      "facility_master",
      "source_records",
      "investment_events",
      "permit_or_milestone_events",
      "geo_dim",
      "taxonomy_dim",
      "entity_resolution_decisions",
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/industrial-opportunity-tracker",
        purpose: "Returns tracker identity, namespace, and supported endpoints.",
      },
      {
        method: "GET",
        path: "/api/industrial-opportunity-tracker/sources",
        purpose: "Returns the prioritized source catalog for Opportunity Tracker inside Industrial Tracker.",
      },
      {
        method: "POST",
        path: "/api/industrial-opportunity-tracker/summary",
        purpose: "Returns county, CBSA, or state rollups for industrial investment and permit signals.",
      },
    ],
  };
}
