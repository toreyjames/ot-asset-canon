import {
  STATE_FIPS,
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  normalizeName,
  safeNumber,
  sha256,
} from "./common.mjs";

function normalizeEiaRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.response?.data)) return payload.response.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchEiaJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EIA request failed: ${response.status} ${url}`);
  }

  return response.json();
}

function buildEiaGeoRow(row) {
  const stateCode = String(
    row.location?.state ||
      row.state ||
      row.plantState ||
      row.stateid ||
      ""
  ).toUpperCase();

  if (!stateCode || !STATE_FIPS[stateCode]) return null;

  const countyFips = row.countyFips || row.county_fips || null;

  return buildGeoRow({
    countyFips,
    stateCode,
    countyName: row.countyName || row.county_name || null,
    cbsaCode: row.cbsaCode || row.cbsa_code || null,
    cbsaName: row.cbsaName || row.cbsa_name || null,
    metadata: { source: "EIA" },
  });
}

export async function ingestEiaElectricity(config = {}) {
  const baseUrl = config.url || process.env.EIA_ELECTRICITY_URL;
  const apiKey = config.apiKey || process.env.EIA_API_KEY;

  if (!baseUrl) {
    throw new Error("EIA_ELECTRICITY_URL is not configured.");
  }

  const url = baseUrl.includes("api_key=") || !apiKey
    ? baseUrl
    : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`;

  const payload = await fetchEiaJson(url);
  const rows = normalizeEiaRows(payload);
  const bundle = emptyBundle();

  for (const row of rows) {
    const plantCode = row.plantId || row.plantid || row.plantCode || row.plant_code || row.plantid_eia;
    const plantName = row.plantName || row.plant_name || row.plant || row.plantNameEia;
    if (!plantCode || !plantName) continue;

    const geoRow = buildEiaGeoRow(row);
    const geoId = geoRow?.id || null;
    if (geoRow) bundle.geoRows.push(geoRow);

    const operatorName =
      row.operatorName || row.operator_name || row.utility_name || row.companyName || plantName;
    const operatorId = deterministicUuid(`entity:eia:${normalizeName(operatorName)}`);
    const facilityId = deterministicUuid(`facility:eia:${plantCode}`);
    const sourceRecordId = deterministicUuid(`source:eia:${plantCode}:${row.period || row.report_date || "current"}`);
    const evidenceId = deterministicUuid(`evidence:eia:${plantCode}:${row.period || row.report_date || "current"}`);
    const signalId = deterministicUuid(`signal:eia:${plantCode}:${row.period || row.report_date || "current"}`);

    bundle.entityRows.push({
      id: operatorId,
      legal_name: operatorName,
      normalized_name: normalizeName(operatorName),
      entity_type: "operator",
      country: "US",
      identifiers: {
        eiaPlantCode: String(plantCode),
      },
      aliases: plantName !== operatorName ? [plantName] : [],
      address: {
        city: row.city || row.plantCity || undefined,
        state:
          row.location?.state ||
          row.state ||
          row.plantState ||
          row.stateid ||
          undefined,
        postalCode: row.zip || row.zipCode || undefined,
        countyFips: row.countyFips || row.county_fips || undefined,
      },
      confidence_score: 86,
      metadata: {
        source: "EIA",
        sector: row.sectorName || row.sector_name || null,
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: operatorId,
      geo_id: geoId,
      facility_name: plantName,
      normalized_name: normalizeName(plantName),
      address: {
        city: row.city || row.plantCity || undefined,
        state:
          row.location?.state ||
          row.state ||
          row.plantState ||
          row.stateid ||
          undefined,
        postalCode: row.zip || row.zipCode || undefined,
        countyFips: row.countyFips || row.county_fips || undefined,
      },
      latitude: row.latitude ? String(row.latitude) : null,
      longitude: row.longitude ? String(row.longitude) : null,
      county_fips: row.countyFips || row.county_fips || null,
      cbsa_code: row.cbsaCode || row.cbsa_code || null,
      facility_source_ids: {
        eiaPlantCode: String(plantCode),
      },
      confidence_score: 88,
      metadata: {
        source: "EIA",
        fuelType: row.fueltype || row.fuelType || row.energySource || null,
        primeMover: row.primemover || row.primeMover || null,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: "EIA",
      source_record_id: `${plantCode}:${row.period || row.report_date || "current"}`,
      source_category: "energy",
      source_url: url,
      source_hash: sha256(JSON.stringify(row)),
      effective_date:
        row.period || row.report_date ? new Date(`${row.period || row.report_date}`).toISOString() : null,
      raw_payload: row,
      extraction_version: "eia-electricity-v1",
    });

    const reportedGeneration =
      safeNumber(row.generation) ??
      safeNumber(row.netGeneration) ??
      safeNumber(row.generationMwh) ??
      safeNumber(row.value);
    const reportedCapability =
      safeNumber(row.capacity) ??
      safeNumber(row.nameplateCapacity) ??
      safeNumber(row.summerCapacity);

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: operatorId,
      geo_id: geoId,
      project_id: null,
      source_name: "EIA",
      dataset: "electricity",
      evidence_type: "energy_infrastructure_observed",
      source_url: url,
      confidence_score: 82,
      observed_at:
        row.period || row.report_date ? new Date(`${row.period || row.report_date}`).toISOString() : new Date().toISOString(),
      raw_payload: row,
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: operatorId,
      geo_id: geoId,
      project_id: null,
      signal_type: reportedCapability ? "plant_capacity_observed" : "plant_generation_observed",
      value:
        reportedCapability !== null
          ? String(reportedCapability)
          : reportedGeneration !== null
            ? String(reportedGeneration)
            : row.fueltype || row.fuelType || "observed",
      unit: reportedCapability !== null ? "MW" : reportedGeneration !== null ? "MWh" : null,
      evidence_id: evidenceId,
      observed_at:
        row.period || row.report_date ? new Date(`${row.period || row.report_date}`).toISOString() : new Date().toISOString(),
      metadata: {
        source: "EIA",
        generationMwh: reportedGeneration,
        capacityMw: reportedCapability,
        fuelType: row.fueltype || row.fuelType || row.energySource || null,
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:eia:${plantCode}:${row.period || row.report_date || "current"}`),
      facility_id: facilityId,
      event_type: "energy_profile_updated",
      occurred_at:
        row.period || row.report_date ? new Date(`${row.period || row.report_date}`).toISOString() : new Date().toISOString(),
      signal_id: signalId,
      metadata: {
        source: "EIA",
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:eia:${plantCode}:${row.period || row.report_date || "current"}`),
      source_record_id: sourceRecordId,
      entity_id: operatorId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: "0.9700",
      features: {
        exactIdentifiers: ["eia_plant_code"],
        nameSimilarity: 1,
        addressMatch: row.state ? 0.6 : 0.2,
        sectorAlignment: true,
      },
      candidate_set: [facilityId],
      chosen: true,
      rationale: "Matched plant on EIA plant code.",
    });
  }

  return bundle;
}
