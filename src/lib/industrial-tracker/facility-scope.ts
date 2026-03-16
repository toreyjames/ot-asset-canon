type FacilityMetadata = {
  source?: string;
  facilityType?: string | null;
  [key: string]: unknown;
} | null | undefined;

export type IndustrialTrackerFacilityScope = "site" | "regional_infrastructure";

export function classifyFacilityScope(metadata: FacilityMetadata): IndustrialTrackerFacilityScope {
  const source = String(metadata?.source || "").trim().toLowerCase();
  const facilityType = String(metadata?.facilityType || "").trim().toLowerCase();

  if (
    facilityType === "balancing_authority_region" ||
    facilityType === "regional_grid_node" ||
    source === "eia grid monitor"
  ) {
    return "regional_infrastructure";
  }

  return "site";
}

export function isRegionalInfrastructureFacility(metadata: FacilityMetadata) {
  return classifyFacilityScope(metadata) === "regional_infrastructure";
}

export function isSiteFacility(metadata: FacilityMetadata) {
  return classifyFacilityScope(metadata) === "site";
}
