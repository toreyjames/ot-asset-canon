export type OpportunityEventType =
  | "federal_award"
  | "incentive_award"
  | "financing_commitment"
  | "capex_announcement"
  | "grant_opportunity"
  | "loan_commitment";

export type OpportunityAmountType =
  | "obligation"
  | "outlay"
  | "commitment"
  | "estimate";

export type OpportunityRollup = "county" | "cbsa" | "state";

export interface OpportunityFilter {
  rollup: OpportunityRollup;
  startDate?: string;
  endDate?: string;
  eventTypes?: OpportunityEventType[];
  amountTypes?: OpportunityAmountType[];
  countyFips?: string[];
  cbsaCodes?: string[];
  stateFips?: string[];
  naicsPrefixes?: string[];
  techTags?: string[];
  minimumAmount?: number;
  includePermits?: boolean;
}

export interface OpportunitySummaryRow {
  geographyType: OpportunityRollup;
  geographyCode: string;
  geographyLabel: string;
  totalAmountUsd: number;
  eventCount: number;
  permitEventCount: number;
  jobsEstimate: number;
  amountPerManufacturingWorker?: number;
  amountPerEstablishment?: number;
  latestActionDate?: string | null;
}

export interface OpportunitySummaryResponse {
  rollup: OpportunityRollup;
  generatedAt: string;
  filtersApplied: OpportunityFilter;
  rows: OpportunitySummaryRow[];
}
