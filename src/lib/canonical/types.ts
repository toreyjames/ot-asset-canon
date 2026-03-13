export type ConfidenceState = "observed" | "inferred" | "disputed" | "unknown";
export type FactKind = "observation" | "inference" | "issue";
export type FreshnessState = "fresh" | "stale" | "unknown";

export interface SourceProvenance {
  source: string;
  reference: string;
  observedAt?: string;
}

export interface FreshnessSummary {
  lastObservedAt?: string;
  freshness: FreshnessState;
  sourceCount: number;
  confidenceReason: string;
}

export interface CanonicalFact {
  id: string;
  kind: FactKind;
  label: string;
  confidence: ConfidenceState;
  observedAt?: string;
  provenance: SourceProvenance[];
}

export interface StrategicRegionSummary {
  id: string;
  label: string;
  totalAmountUsd: number;
  eventCount: number;
  permitEventCount: number;
}

export interface StrategicView {
  generatedAt: string;
  metrics: {
    totalTrackedUsd: number;
    facilityCount: number;
    infrastructureNodeCount: number;
    evidenceCount: number;
    queueProjectCount: number;
  };
  topRegions: StrategicRegionSummary[];
  topSectors: Array<{ label: string; valueUsd: number; projectCount: number }>;
}

export interface CompanyProfile {
  companyId: string;
  legalName: string;
  sites: Array<{ siteId: string; siteName: string; geography: string }>;
  programs: string[];
  investments: Array<{ amountLabel: string; sourceTag: string; facilityId: string }>;
  identity: {
    canonicalId: string;
    resolutionBasis: string;
  };
  facts: CanonicalFact[];
  freshness: FreshnessSummary;
  provenance: SourceProvenance[];
}

export interface SiteProfile {
  siteId: string;
  companyId: string;
  siteName: string;
  geography: string;
  facilities: Array<{ facilityId: string; facilityName: string }>;
  programs: string[];
  investments: Array<{ amountLabel: string; status: string; sourceTag: string }>;
  identity: {
    canonicalId: string;
    sourceIds: Record<string, string>;
    resolutionBasis: string;
  };
  facts: CanonicalFact[];
  freshness: FreshnessSummary;
  provenance: SourceProvenance[];
}

export interface FacilityProfile {
  facilityId: string;
  facilityName: string;
  geography: string;
  companyName?: string;
  latestEvidenceType?: string;
  latestEventType?: string;
  latestObservedAt?: string;
  programLinks: Array<{ programType: string; externalProgramId: string; agency?: string | null }>;
  evidenceTimeline: Array<{ id: string; observedAt: string; evidenceType: string; sourceName: string }>;
  eventTimeline: Array<{ id: string; occurredAt: string; eventType: string }>;
  identity: {
    canonicalId: string;
    sourceIds: Record<string, string>;
    resolutionBasis: string;
  };
  facts: CanonicalFact[];
  freshness: FreshnessSummary;
  provenance: SourceProvenance[];
}

export interface MissionMapNode {
  id: string;
  label: string;
  nodeType: "site" | "facility" | "line" | "asset" | "control" | "network";
  confidence: ConfidenceState;
  kind: Exclude<FactKind, "issue">;
  level: number;
  sourceCount: number;
  parentId?: string;
  lastObservedAt?: string;
}

export interface MissionMapEdge {
  id: string;
  from: string;
  to: string;
  edgeType: "contains" | "depends_on" | "connected_to" | "controlled_by";
  confidence: ConfidenceState;
  kind: Exclude<FactKind, "issue">;
  sourceCount: number;
  lastObservedAt?: string;
}

export interface MissionMapView {
  facilityId: string;
  layers: Array<"physical" | "control" | "network" | "dependency" | "confidence">;
  nodes: MissionMapNode[];
  edges: MissionMapEdge[];
  facts: CanonicalFact[];
  freshness: FreshnessSummary;
  provenance: SourceProvenance[];
}

export interface AssetProfile {
  assetId: string;
  assetName: string;
  assetType: string;
  facilityId: string;
  facilityName: string;
  confidence: ConfidenceState;
  dependencyContext: string[];
  facts: CanonicalFact[];
  freshness: FreshnessSummary;
  provenance: SourceProvenance[];
}

export interface IssueRecord {
  id: string;
  kind: "issue";
  category:
    | "missing_dependency"
    | "undocumented_asset"
    | "documentation_mismatch"
    | "topology_contradiction";
  title: string;
  confidence: ConfidenceState;
  facilityId?: string;
  assetId?: string;
  observedAt?: string;
  provenance: SourceProvenance[];
}
