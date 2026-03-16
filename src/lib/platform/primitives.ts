export interface PlatformEntityReference {
  id: string;
  name: string;
  kind: "company" | "agency" | "facility-owner" | "supplier";
  identifiers?: Record<string, string>;
}

export interface PlatformFacilityReference {
  id: string;
  name: string;
  entityId?: string;
  countyFips?: string;
  cbsaCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlatformGeographyReference {
  countyFips?: string;
  stateFips?: string;
  cbsaCode?: string;
  label: string;
}
