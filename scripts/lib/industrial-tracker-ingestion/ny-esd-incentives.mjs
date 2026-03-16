import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  readJsonSource,
  readIntEnv,
  safeNumber,
  sha256,
  supabaseFetch,
  techTagsFromText,
} from "./common.mjs";

const DEFAULT_NY_ESD_URL = "https://data.ny.gov/resource/26ei-n4eb.json";
const DEFAULT_NY_ESD_VIEW_URL =
  "https://data.ny.gov/api/views/26ei-n4eb/rows.json?accessType=DOWNLOAD";
const DEFAULT_LIMIT = 2000;

const INDUSTRIAL_KEYWORDS = [
  "manufactur",
  "semiconductor",
  "chip",
  "wafer",
  "fab",
  "battery",
  "cathode",
  "anode",
  "mineral",
  "mining",
  "refin",
  "chemical",
  "petro",
  "steel",
  "metal",
  "aluminum",
  "aerospace",
  "defense",
  "electronics",
  "assembly",
  "data center",
  "datacenter",
  "cooling",
  "transformer",
  "substation",
  "transmission",
  "power",
  "grid",
  "reactor",
  "nuclear",
];

function normalizeCountyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(county|parish|borough|census area|municipio|municipality|city and borough|city)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNyQuery(limit) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $order: "start_date DESC",
  });

  return `${DEFAULT_NY_ESD_URL}?${params.toString()}`;
}

function extractRowsJsonRecords(payload) {
  const columns = payload?.meta?.view?.columns || [];
  const data = payload?.data || [];
  if (!Array.isArray(columns) || !Array.isArray(data)) return [];

  const fieldNames = columns.map((column) => column?.fieldName).filter(Boolean);
  return data.map((row) =>
    Object.fromEntries(fieldNames.map((fieldName, index) => [fieldName, row[index]]))
  );
}

function isIndustrialRecord(record) {
  const haystack = [
    record.industry,
    record.project_description,
    record.program_through_which_the_funding_was_awarded,
    record.name_of_project,
    record.recipient_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return INDUSTRIAL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function buildTechTags(record) {
  const tags = new Set(
    techTagsFromText(
      record.industry,
      record.project_description,
      record.program_through_which_the_funding_was_awarded,
      record.name_of_project
    )
  );

  const haystack = [
    record.industry,
    record.project_description,
    record.program_through_which_the_funding_was_awarded,
    record.name_of_project,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("data center") || haystack.includes("datacenter")) tags.add("data_center");
  if (haystack.includes("ai")) tags.add("ai");
  if (haystack.includes("transformer") || haystack.includes("substation") || haystack.includes("transmission")) {
    tags.add("grid_equipment");
  }
  if (haystack.includes("nuclear") || haystack.includes("reactor")) tags.add("advanced_nuclear");
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");

  return Array.from(tags);
}

async function loadNyCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=county_fips,county_name,state_code&state_code=eq.NY&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [normalizeCountyName(row.county_name), row.county_fips])
  );
}

async function fetchNyRecords() {
  const limit = readIntEnv("NY_ESD_LIMIT", DEFAULT_LIMIT);
  const candidates = [
    process.env.NY_ESD_URL || buildNyQuery(limit),
    `${DEFAULT_NY_ESD_URL}?${new URLSearchParams({ $limit: String(limit), $order: "start_date DESC" }).toString()}`,
    DEFAULT_NY_ESD_VIEW_URL,
  ].filter(Boolean);

  const errors = [];
  const headers = {
    "User-Agent":
      process.env.NY_ESD_USER_AGENT ||
      process.env.SEC_USER_AGENT ||
      "Baseload Industrial Tracker contact@aibaseload.com",
    Accept: "application/json",
    ...(process.env.NY_ESD_APP_TOKEN
      ? { "X-App-Token": process.env.NY_ESD_APP_TOKEN }
      : {}),
  };

  for (const source of candidates) {
    try {
      let payload;
      if (/^https?:\/\//i.test(source)) {
        const response = await fetch(source, { headers });
        if (!response.ok) {
          throw new Error(`JSON download failed: ${response.status} ${source}`);
        }
        payload = await response.json();
      } else {
        payload = await readJsonSource(source);
      }

      if (Array.isArray(payload)) return payload;

      const rowsJsonRecords = extractRowsJsonRecords(payload);
      if (rowsJsonRecords.length) return rowsJsonRecords;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors.join(" | "));
}

export async function ingestNyEsdIncentives() {
  const [records, countyFipsByName] = await Promise.all([
    fetchNyRecords(),
    loadNyCountyMap(),
  ]);

  const bundle = emptyBundle();
  const sourceName = "Empire State Development Incentives";
  const sourceUrl = process.env.NY_ESD_URL || buildNyQuery(readIntEnv("NY_ESD_LIMIT", DEFAULT_LIMIT));

  for (const record of records) {
    if (!isIndustrialRecord(record)) continue;

    const companyName = record.recipient_name || record.name_of_project;
    if (!companyName) continue;

    const projectIdNumber = record.project_id_number || normalizeName(companyName);
    const companyId = deterministicUuid(`entity:ny-esd:${normalizeName(companyName)}`);
    const normalizedCounty = normalizeCountyName(record.county);
    const countyFips = countyFipsByName.get(normalizedCounty) || null;
    const geoRow = buildGeoRow({
      countyFips,
      stateCode: "NY",
      countyName: record.county || null,
      metadata: {
        source: sourceName,
        region: record.economic_development_region || null,
      },
    });
    const geoId = geoRow?.id || null;
    const facilityName = record.name_of_project || companyName;
    const facilityId = deterministicUuid(`facility:ny-esd:${projectIdNumber}`);
    const sourceRecordId = deterministicUuid(`source:ny-esd:${projectIdNumber}`);
    const projectId = deterministicUuid(`project:ny-esd:${projectIdNumber}`);
    const evidenceId = deterministicUuid(`evidence:ny-esd:${projectIdNumber}`);
    const signalId = deterministicUuid(`signal:ny-esd:${projectIdNumber}`);
    const totalInvestment =
      safeNumber(record.total_public_private_investment) ||
      safeNumber(record.original_total_public_private_investment);
    const assistanceAmount =
      safeNumber(record.total_lead_agency_benefits_awarded) ||
      safeNumber(record.assistance_amount) ||
      safeNumber(record.original_assistance_amount);
    const observedAt =
      isoDate(record.start_date || record.end_date) || new Date().toISOString();
    const techTags = buildTechTags(record);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      address: {
        state: "NY",
        countyFips: countyFips || undefined,
      },
      confidence_score: 78,
      metadata: {
        source: sourceName,
        region: record.economic_development_region || null,
        ownershipType: record.is_the_award_to_a_public_or_private_sector_entity_ || null,
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: facilityName,
      normalized_name: normalizeName(facilityName),
      address: {
        state: "NY",
        countyFips: countyFips || undefined,
      },
      latitude: null,
      longitude: null,
      county_fips: countyFips,
      cbsa_code: null,
      facility_source_ids: {},
      confidence_score: 72,
      metadata: {
        source: sourceName,
        region: record.economic_development_region || null,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: String(projectIdNumber),
      source_category: "incentive",
      source_url: sourceUrl,
      source_hash: sha256(JSON.stringify(record)),
      effective_date: observedAt,
      raw_payload: record,
      extraction_version: "ny-esd-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "state_incentive_project",
      sector: record.industry || null,
      investment_amount: totalInvestment,
      announcement_date: isoDate(record.start_date),
      construction_start: isoDate(record.start_date),
      completion_estimate: isoDate(record.end_date),
      status: record.project_status || "observed",
      metadata: {
        source: sourceName,
        region: record.economic_development_region || null,
        assistanceType: record.assistance_type || null,
      },
    });

    if (assistanceAmount !== null) {
      bundle.investmentRows.push({
        id: deterministicUuid(`investment:ny-esd:${projectIdNumber}`),
        source_record_id: sourceRecordId,
        provider_entity_id: null,
        recipient_entity_id: companyId,
        facility_id: facilityId,
        geo_id: geoId,
        taxonomy_id: null,
        event_type: "state_incentive_awarded",
        amount: String(assistanceAmount),
        amount_type: "state_incentive",
        currency: "USD",
        announced_date: isoDate(record.start_date),
        action_date: observedAt,
        start_date: isoDate(record.start_date),
        end_date: isoDate(record.end_date),
        provider_name: record.lead_agency_name || "Empire State Development",
        recipient_name: companyName,
        program_name: record.program_through_which_the_funding_was_awarded || null,
        award_type: record.assistance_type || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        jobs_estimate: null,
        capex_estimate: totalInvestment,
        county_fips: countyFips,
        cbsa_code: null,
        place_of_performance: {
          state: "NY",
          county: record.county || null,
        },
        recipient_location: {
          state: "NY",
          county: record.county || null,
        },
        confidence_score: 76,
        provenance: {
          matchedEntityStrategy: "ny_esd_recipient_name",
          matchedFacilityStrategy: "ny_esd_project_id",
        },
      });
    }

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      source_name: sourceName,
      dataset: "ny_esd_incentives",
      evidence_type: "state_incentive_observed",
      source_url: sourceUrl,
      confidence_score: 74,
      observed_at: observedAt,
      raw_payload: record,
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "state_incentive_recorded",
      value: record.project_status || record.assistance_type || "observed",
      unit: null,
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        source: sourceName,
        assistanceAmount,
        totalInvestment,
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:ny-esd:${projectIdNumber}`),
      facility_id: facilityId,
      event_type: "state_incentive_awarded",
      occurred_at: observedAt,
      signal_id: signalId,
      metadata: {
        source: sourceName,
        programName: record.program_through_which_the_funding_was_awarded || null,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:ny-esd:${projectIdNumber}`),
      source_record_id: sourceRecordId,
      resolved_entity_id: companyId,
      resolved_facility_id: facilityId,
      strategy: "state_source_project_id",
      candidate_set: {
        recipientName: companyName,
        county: record.county || null,
      },
      score: 0.78,
      decision_reason: "Bound New York incentive record to canonical company and project-scoped facility.",
      metadata: {
        source: sourceName,
      },
    });
  }

  return bundle;
}
