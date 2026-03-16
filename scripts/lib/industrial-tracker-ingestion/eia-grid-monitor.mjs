import {
  STATE_FIPS,
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  normalizeName,
  safeNumber,
  sha256,
} from "./common.mjs";

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.response?.data)) return payload.response.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchGridJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EIA grid monitor request failed: ${response.status} ${url}`);
  }

  return response.json();
}

function inferStateCode(row) {
  const direct =
    row.state ||
    row.stateid ||
    row["stateid"] ||
    row.location?.state ||
    null;

  if (direct && STATE_FIPS[String(direct).toUpperCase()]) {
    return String(direct).toUpperCase();
  }

  return null;
}

function buildGridGeoRow(row) {
  const stateCode = inferStateCode(row);
  if (!stateCode) return null;

  return buildGeoRow({
    countyFips: null,
    stateCode,
    countyName: null,
    cbsaCode: null,
    cbsaName: null,
    metadata: { source: "EIA Grid Monitor" },
  });
}

function pickRegionCode(row) {
  return (
    row.respondent ||
    row.respondent_id ||
    row.respondentId ||
    row.balancing_authority ||
    row.ba ||
    row.region ||
    row.subba ||
    row.sub_ba ||
    null
  );
}

function pickRegionName(row) {
  return (
    row["respondent-name"] ||
    row.respondent_name ||
    row.respondentName ||
    row.ba_name ||
    row.region_name ||
    row.subba_name ||
    pickRegionCode(row)
  );
}

function pickObservedAt(row) {
  const value = row.period || row.timestamp || row.datetime || row.report_date || null;
  if (!value) return new Date().toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
}

function pickMetric(row) {
  const candidates = [
    ["load_mw", "MW"],
    ["load", "MW"],
    ["value", null],
    ["demand", "MW"],
    ["demand_mw", "MW"],
    ["capacity", "MW"],
    ["capacity_mw", "MW"],
    ["interchange", "MW"],
    ["interchange_mw", "MW"],
    ["net_generation", "MW"],
    ["generation", "MW"],
  ];

  for (const [key, unit] of candidates) {
    const value = safeNumber(row[key]);
    if (value !== null) {
      return { value, unit, key };
    }
  }

  return { value: null, unit: null, key: null };
}

function signalTypeForKey(key) {
  switch (key) {
    case "load_mw":
    case "load":
    case "demand":
    case "demand_mw":
      return "grid_load_observed";
    case "capacity":
    case "capacity_mw":
      return "grid_capacity_observed";
    case "interchange":
    case "interchange_mw":
      return "grid_interchange_observed";
    case "net_generation":
    case "generation":
      return "grid_generation_observed";
    default:
      return "grid_signal_observed";
  }
}

export async function ingestEiaGridMonitor(config = {}) {
  const baseUrl = config.url || process.env.EIA_GRID_URL;
  const apiKey = config.apiKey || process.env.EIA_API_KEY;

  if (!baseUrl) {
    throw new Error("EIA_GRID_URL is not configured.");
  }

  const url =
    baseUrl.includes("api_key=") || !apiKey
      ? baseUrl
      : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`;

  const payload = await fetchGridJson(url);
  const rows = normalizeRows(payload);
  const bundle = emptyBundle();

  for (const row of rows) {
    const regionCode = pickRegionCode(row);
    const regionName = pickRegionName(row);
    if (!regionCode || !regionName) continue;

    const observedAt = pickObservedAt(row);
    const metric = pickMetric(row);
    const geoRow = buildGridGeoRow(row);
    const geoId = geoRow?.id || null;
    if (geoRow) bundle.geoRows.push(geoRow);

    const entityId = deterministicUuid(`entity:eia-grid:${normalizeName(regionName)}`);
    const facilityId = deterministicUuid(`facility:eia-grid:${regionCode}`);
    const recordKey = `${regionCode}:${observedAt}`;
    const sourceRecordId = deterministicUuid(`source:eia-grid:${recordKey}`);
    const evidenceId = deterministicUuid(`evidence:eia-grid:${recordKey}`);
    const signalId = deterministicUuid(`signal:eia-grid:${recordKey}`);

    bundle.entityRows.push({
      id: entityId,
      legal_name: regionName,
      normalized_name: normalizeName(regionName),
      entity_type: "operator",
      country: "US",
      identifiers: {
        balancingAuthority: String(regionCode),
      },
      aliases: [],
      address: {
        state: inferStateCode(row) || undefined,
      },
      confidence_score: 84,
      metadata: {
        source: "EIA Grid Monitor",
        regionCode: String(regionCode),
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: entityId,
      geo_id: geoId,
      facility_name: regionName,
      normalized_name: normalizeName(regionName),
      address: {
        state: inferStateCode(row) || undefined,
      },
      latitude: null,
      longitude: null,
      county_fips: null,
      cbsa_code: null,
      facility_source_ids: {
        balancingAuthority: String(regionCode),
      },
      confidence_score: 82,
      metadata: {
        source: "EIA Grid Monitor",
        facilityType: "balancing_authority_region",
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: "EIA Grid Monitor",
      source_record_id: recordKey,
      source_category: "energy",
      source_url: url,
      source_hash: sha256(JSON.stringify(row)),
      effective_date: observedAt,
      raw_payload: row,
      extraction_version: "eia-grid-monitor-v1",
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: entityId,
      geo_id: geoId,
      project_id: null,
      source_name: "EIA Grid Monitor",
      dataset: "grid_monitor",
      evidence_type: "grid_region_observed",
      source_url: url,
      confidence_score: 80,
      observed_at: observedAt,
      raw_payload: row,
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: entityId,
      geo_id: geoId,
      project_id: null,
      signal_type: signalTypeForKey(metric.key),
      value: metric.value !== null ? String(metric.value) : String(regionCode),
      unit: metric.unit,
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        source: "EIA Grid Monitor",
        metricKey: metric.key,
        regionCode: String(regionCode),
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:eia-grid:${recordKey}`),
      facility_id: facilityId,
      event_type: "grid_profile_updated",
      occurred_at: observedAt,
      signal_id: signalId,
      metadata: {
        source: "EIA Grid Monitor",
        regionCode: String(regionCode),
      },
    });

    bundle.programLinkRows.push({
      id: deterministicUuid(`program-link:eia-grid:${regionCode}`),
      facility_id: facilityId,
      program_type: "balancing_authority",
      external_program_id: String(regionCode),
      agency: "EIA Grid Monitor",
      metadata: {
        regionName,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:eia-grid:${recordKey}`),
      source_record_id: sourceRecordId,
      entity_id: entityId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: "0.9500",
      features: {
        exactIdentifiers: ["balancing_authority"],
        nameSimilarity: 1,
        addressMatch: inferStateCode(row) ? 0.4 : 0.1,
        sectorAlignment: true,
      },
      candidate_set: [facilityId],
      chosen: true,
      rationale: "Matched grid region on balancing authority / respondent identifier.",
    });
  }

  return bundle;
}
