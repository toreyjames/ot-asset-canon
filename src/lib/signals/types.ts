export const VALID_SOURCES = [
  "sam.gov",
  "usaspending",
  "fpds",
  "epa",
  "sec-edgar",
  "eia",
  "fred",
  "fda",
  "federal-register",
  "news-rss",
] as const;

export const VALID_SECTORS = [
  "defense",
  "aerospace",
  "life-sciences",
  "pharma",
  "nuclear",
  "semiconductor",
  "data-center",
  "energy",
  "critical-minerals",
  "ev-battery",
  "manufacturing",
  "chemical",
  "water",
  "oil-gas",
] as const;

export const VALID_SIGNAL_TYPES = [
  "rfp",
  "contract-award",
  "facility-permit",
  "enforcement",
  "capex-disclosure",
  "cyber-incident",
  "funding-flow",
  "expansion",
  "regulatory-action",
  "risk-disclosure",
  "inspection",
  "modification",
] as const;

export type SignalSource = (typeof VALID_SOURCES)[number];
export type SignalSector = (typeof VALID_SECTORS)[number];
export type SignalType = (typeof VALID_SIGNAL_TYPES)[number];

export interface Signal {
  id: string;
  source: SignalSource;
  sourceId: string;
  timestamp: string;
  entity: string;
  sector: SignalSector;
  signalType: SignalType;
  location: string;
  value: number;
  description: string;
  url: string;
  otRelevanceScore: number;
  otKeywords: string[];
  rawData: Record<string, unknown>;
}

export interface SignalsResponse {
  success: boolean;
  signals: Signal[];
  meta: {
    total: number;
    filtered: number;
    timestamp: string;
    source: "ot-radar";
  };
}

export interface SignalsQueryParams {
  sector?: string[];
  since?: string;
  signalType?: string[];
  minRelevance?: number;
  limit?: number;
}
