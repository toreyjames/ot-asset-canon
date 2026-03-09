export type IndustrialNodeType =
  | "Asset"
  | "ProcessNode"
  | "NetworkNode"
  | "Facility"
  | "Zone";

export type IndustrialEdgeType =
  | "controlled_by"
  | "connected_to"
  | "feeds"
  | "part_of"
  | "located_in"
  | "depends_on";

export interface IndustrialNode {
  id: string;
  type: IndustrialNodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface IndustrialEdge {
  id: string;
  type: IndustrialEdgeType;
  from: string;
  to: string;
  confidence: number;
}

export interface IndustrialGraph {
  nodes: IndustrialNode[];
  edges: IndustrialEdge[];
}

export interface CandidateAssetRecord {
  source: string;
  sourceId: string;
  candidateType: "asset" | "process" | "network";
  name: string;
  vendor?: string;
  zone?: string;
  properties?: Record<string, unknown>;
}

export interface CanonicalAsset {
  id: string;
  canonicalName: string;
  aliases: string[];
  sourceIds: string[];
  confidence: number;
  zone?: string;
  vendor?: string;
  properties: Record<string, unknown>;
}

export interface GraphQueryRequest {
  mode: "search" | "graph" | "natural";
  query: string;
}

export interface GraphQueryResult {
  summary: string;
  nodes: IndustrialNode[];
  edges: IndustrialEdge[];
}
