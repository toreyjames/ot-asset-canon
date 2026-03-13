import { industrialTrackerDemoSnapshot } from "./demo-data";
import { isSupabaseServerConfigured, supabaseServerFetch } from "@/lib/platform/supabase-server";

export interface IndustrialTrackerFacilityDetail {
  facilityId: string;
  facilityName: string;
  geography: string;
  sourceIds: Record<string, string>;
  companyName?: string;
  latestObservedAt?: string;
  latestEventType?: string;
  latestEvidenceType?: string;
  programLinks: Array<{
    programType: string;
    externalProgramId: string;
    agency?: string | null;
  }>;
  evidenceTimeline: Array<{
    id: string;
    observedAt: string;
    evidenceType: string;
    sourceName: string;
  }>;
  eventTimeline: Array<{
    id: string;
    occurredAt: string;
    eventType: string;
  }>;
  mapPoint: {
    latitude: number;
    longitude: number;
    status: "validated" | "invalid";
    source: string;
  } | null;
}

type SupabaseFacilityDetailRow = {
  id: string;
  facility_name: string;
  address: {
    city?: string;
    state?: string;
  } | null;
  facility_source_ids: Record<string, string> | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
};

type SupabaseEntityRow = {
  id: string;
  legal_name: string;
};

type SupabaseEvidenceRow = {
  id: string;
  evidence_type: string;
  source_name: string;
  observed_at: string;
};

type SupabaseFacilityEventRow = {
  id: string;
  event_type: string;
  occurred_at: string;
};

type SupabaseProgramLinkRow = {
  id: string;
  program_type: string;
  external_program_id: string;
  agency: string | null;
};

function demoFacilityDetail(facilityId: string): IndustrialTrackerFacilityDetail | null {
  const item = industrialTrackerDemoSnapshot.facilityTimeline.find(
    (entry) => entry.facilityId === facilityId
  );

  if (!item) {
    return null;
  }

  return {
    facilityId: item.facilityId,
    facilityName: item.facilityName,
    geography: item.geography,
    sourceIds: {},
    companyName: item.facilityName,
    latestObservedAt: item.latestObservedAt,
    latestEventType: item.latestEventType,
    latestEvidenceType: item.latestEvidenceType,
    programLinks: item.programTypes.map((programType) => ({
      programType,
      externalProgramId: "demo",
      agency: "EPA",
    })),
    evidenceTimeline: [
      {
        id: `${item.facilityId}-evidence`,
        observedAt: item.latestObservedAt,
        evidenceType: item.latestEvidenceType,
        sourceName: item.sourceTag,
      },
    ],
    eventTimeline: [
      {
        id: `${item.facilityId}-event`,
        occurredAt: item.latestObservedAt,
        eventType: item.latestEventType,
      },
    ],
    mapPoint: null,
  };
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function validateMapPoint(
  metadata: Record<string, unknown> | null
): IndustrialTrackerFacilityDetail["mapPoint"] {
  if (!metadata) return null;
  const latitude =
    parseCoordinate(metadata.latitude) ??
    parseCoordinate(metadata.lat) ??
    parseCoordinate(metadata["geo_lat"]);
  const longitude =
    parseCoordinate(metadata.longitude) ??
    parseCoordinate(metadata.lon) ??
    parseCoordinate(metadata.lng) ??
    parseCoordinate(metadata["geo_lon"]);

  if (latitude === null || longitude === null) return null;

  // Broad US + territories bounding sanity window to suppress bad map points.
  const inRange = latitude >= 18 && latitude <= 72 && longitude >= -170 && longitude <= -60;
  const valid = inRange && !(Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01);

  return {
    latitude,
    longitude,
    status: valid ? "validated" : "invalid",
    source: "facility.metadata",
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function loadIndustrialTrackerFacilityDetail(
  facilityId: string
): Promise<IndustrialTrackerFacilityDetail | null> {
  if (!isUuid(facilityId)) {
    return demoFacilityDetail(facilityId);
  }

  if (!isSupabaseServerConfigured()) {
    return demoFacilityDetail(facilityId);
  }

  const facilityRows = (await supabaseServerFetch(
    `facility_master?select=id,facility_name,address,facility_source_ids,entity_id,metadata&id=eq.${facilityId}&limit=1`
  )) as SupabaseFacilityDetailRow[];
  const facility = facilityRows[0];

  if (!facility) {
    return demoFacilityDetail(facilityId);
  }

  const [entityRows, evidenceRows, eventRows, programLinkRows] = await Promise.all([
    facility.entity_id
      ? (supabaseServerFetch(
          `entity_master?select=id,legal_name&id=eq.${facility.entity_id}&limit=1`
        ) as Promise<SupabaseEntityRow[]>)
      : Promise.resolve([]),
    supabaseServerFetch(
      `evidence_records?select=id,evidence_type,source_name,observed_at&facility_id=eq.${facilityId}&order=observed_at.desc&limit=20`
    ) as Promise<SupabaseEvidenceRow[]>,
    supabaseServerFetch(
      `facility_events?select=id,event_type,occurred_at&facility_id=eq.${facilityId}&order=occurred_at.desc&limit=20`
    ) as Promise<SupabaseFacilityEventRow[]>,
    supabaseServerFetch(
      `program_links?select=id,program_type,external_program_id,agency&facility_id=eq.${facilityId}&order=updated_at.desc&limit=20`
    ) as Promise<SupabaseProgramLinkRow[]>,
  ]);

  const geography = [facility.address?.city, facility.address?.state]
    .filter(Boolean)
    .join(", ");

  return {
    facilityId: facility.id,
    facilityName: facility.facility_name,
    geography: geography || "Unknown geography",
    sourceIds: facility.facility_source_ids || {},
    companyName: entityRows[0]?.legal_name,
    latestObservedAt: evidenceRows[0]?.observed_at || eventRows[0]?.occurred_at,
    latestEventType: eventRows[0]?.event_type,
    latestEvidenceType: evidenceRows[0]?.evidence_type,
    programLinks: programLinkRows.map((row) => ({
      programType: row.program_type,
      externalProgramId: row.external_program_id,
      agency: row.agency,
    })),
    evidenceTimeline: evidenceRows.map((row) => ({
      id: row.id,
      observedAt: row.observed_at,
      evidenceType: row.evidence_type,
      sourceName: row.source_name,
    })),
    eventTimeline: eventRows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      eventType: row.event_type,
    })),
    mapPoint: validateMapPoint(facility.metadata),
  };
}
