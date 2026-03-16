import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  formatCountyFips,
  isoDate,
  normalizeName,
  readIntEnv,
  sha256,
  safeNumber,
} from "./common.mjs";

const DEFAULT_QUEUE_URL =
  process.env.INTERCONNECTION_QUEUE_URL ||
  "https://eta-publications.lbl.gov/sites/default/files/2025-08/lbnl_ix_queue_data_file_thru2024_v2.xlsx";

const DEFAULT_SOURCE_NAME = "Queued Up Interconnection Queue";
const DEFAULT_SOURCE_PAGE = "https://emp.lbl.gov/queues";

function truncate(value, maxLength = 255) {
  if (value === null || value === undefined) return value;
  return String(value).slice(0, maxLength);
}

function excelDateToIso(value) {
  if (value === null || value === undefined || value === "" || value === "NA") return null;
  if (value instanceof Date && Number.isFinite(value.valueOf())) {
    return new Date(value.valueOf()).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const asDate = new Date(
      Date.UTC(
        parsed.y,
        Math.max(0, (parsed.m || 1) - 1),
        parsed.d || 1,
        parsed.H || 0,
        parsed.M || 0,
        Math.round(parsed.S || 0)
      )
    );
    return Number.isFinite(asDate.valueOf()) ? asDate.toISOString() : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toUpperCase() === "NA") return null;
    const parsed = new Date(trimmed);
    return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
  }
  return null;
}

function asText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return !text || text.toUpperCase() === "NA" ? null : text;
}

function asNumber(value) {
  if (value === null || value === undefined || value === "" || value === "NA") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadQueueRecords(source, rowLimit, minMw) {
  const workbookBuffer =
    source.startsWith("http://") || source.startsWith("https://")
      ? Buffer.from(await (await fetch(source, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: DEFAULT_SOURCE_PAGE,
          },
        })).arrayBuffer())
      : await readFile(source);

  const workbook = XLSX.read(workbookBuffer, {
    type: "buffer",
    cellDates: true,
  });
  const worksheet = workbook.Sheets["03. Complete Queue Data"];
  if (!worksheet) {
    throw new Error('Worksheet "03. Complete Queue Data" not found in interconnection queue workbook.');
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    raw: true,
    defval: null,
    range: 1,
  });
  const acceptedStatuses = new Set(["active", "operational", "suspended"]);

  const parsed = rows
    .map((record) => {
      const status = (asText(record.q_status) || "").toLowerCase();
      if (!acceptedStatuses.has(status)) return null;

      const mwTotal =
        (asNumber(record.mw1) || 0) +
        (asNumber(record.mw2) || 0) +
        (asNumber(record.mw3) || 0);
      if (mwTotal < minMw) return null;

      const queueId = asText(record.q_id);
      if (!queueId) return null;

      const countyFipsNumber = asNumber(record.fips_codes);
      const countyFips =
        countyFipsNumber !== null
          ? String(Math.trunc(countyFipsNumber)).padStart(5, "0")
          : null;

      return {
        id: queueId,
        qStatus: status,
        qDate: excelDateToIso(record.q_date),
        proposedDate: excelDateToIso(record.prop_date),
        operationalDate: excelDateToIso(record.on_date),
        withdrawnDate: excelDateToIso(record.wd_date),
        agreementDate: excelDateToIso(record.ia_date),
        countyName: asText(record.county),
        state: asText(record.state),
        countyFips: countyFips && countyFips.length === 5 ? countyFips : null,
        poiName: asText(record.poi_name),
        region: asText(record.region),
        projectName: asText(record.project_name),
        utility: asText(record.utility),
        entity: asText(record.entity),
        developer: asText(record.developer),
        service: asText(record.service),
        projectCategory: asText(record.project_type),
        typeClean: asText(record.type_clean),
        type1: asText(record.type1),
        type2: asText(record.type2),
        type3: asText(record.type3),
        capacityMw: mwTotal,
        queueYear: asNumber(record.q_year),
        proposedYear: asNumber(record.prop_year),
        sourceUrl: source.startsWith("http") ? source : DEFAULT_SOURCE_PAGE,
      };
    })
    .filter(Boolean);

  const statusRank = { active: 3, suspended: 2, operational: 1 };
  parsed.sort(
    (a, b) =>
      (statusRank[b.qStatus] || 0) - (statusRank[a.qStatus] || 0) ||
      (b.proposedYear || 0) - (a.proposedYear || 0) ||
      (b.queueYear || 0) - (a.queueYear || 0) ||
      (b.capacityMw || 0) - (a.capacityMw || 0)
  );

  return rowLimit ? parsed.slice(0, rowLimit) : parsed;
}

function techTagsForQueueRecord(record) {
  const tags = new Set(["interconnection_queue", "power"]);
  const haystack = [
    record.projectCategory,
    record.typeClean,
    record.type1,
    record.type2,
    record.type3,
    record.service,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("solar")) tags.add("solar");
  if (haystack.includes("wind")) tags.add("wind");
  if (haystack.includes("storage")) tags.add("storage");
  if (haystack.includes("battery")) tags.add("battery_storage");
  if (haystack.includes("gas")) tags.add("gas_turbine");
  if (haystack.includes("nuclear")) tags.add("nuclear");
  if (haystack.includes("hydrogen")) tags.add("hydrogen");
  if (haystack.includes("hybrid")) tags.add("hybrid");
  if (haystack.includes("transmission")) tags.add("transmission");
  if (haystack.includes("substation")) tags.add("substation");
  if (haystack.includes("generation")) tags.add("generation");

  return Array.from(tags);
}

export async function ingestInterconnectionQueue() {
  const bundle = emptyBundle();
  const rowLimit = readIntEnv("INTERCONNECTION_QUEUE_LIMIT", 500);
  const minMw = readIntEnv("INTERCONNECTION_QUEUE_MIN_MW", 100);
  const records = await loadQueueRecords(DEFAULT_QUEUE_URL, rowLimit, minMw);

  for (const record of records) {
    const companyName = truncate(
      record.developer || record.entity || record.utility || "Observed developer"
    );
    const companyId = deterministicUuid(`entity:interconnection:${normalizeName(companyName)}`);
    const facilityName = truncate(
      record.projectName || record.poiName || `${companyName} queue project`
    );
    const facilityId = deterministicUuid(`facility:interconnection:${record.id}`);
    const sourceRecordId = deterministicUuid(`source:interconnection:${record.id}`);
    const projectId = deterministicUuid(`project:interconnection:${record.id}`);
    const evidenceId = deterministicUuid(`evidence:interconnection:${record.id}`);
    const signalId = deterministicUuid(`signal:interconnection:${record.id}`);
    const geoRow = buildGeoRow({
      countyFips: record.countyFips || null,
      stateCode: record.state || null,
      countyName: record.countyName || null,
      metadata: { source: DEFAULT_SOURCE_NAME, region: record.region || null },
    });
    const geoId = geoRow?.id || null;
    const observedAt =
      isoDate(record.agreementDate) ||
      isoDate(record.operationalDate) ||
      isoDate(record.proposedDate) ||
      isoDate(record.qDate) ||
      new Date().toISOString();
    const techTags = techTagsForQueueRecord(record);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [record.entity, record.utility].filter(Boolean),
      address: {
        state: record.state || undefined,
        countyFips: record.countyFips || undefined,
      },
      confidence_score: 68,
      metadata: {
        source: DEFAULT_SOURCE_NAME,
        utility: truncate(record.utility || null),
        region: record.region || null,
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: facilityName,
      normalized_name: normalizeName(facilityName),
      address: {
        city: undefined,
        state: record.state || undefined,
        countyFips: record.countyFips || undefined,
      },
      latitude: null,
      longitude: null,
      county_fips: record.countyFips || null,
      cbsa_code: null,
      facility_source_ids: {},
      confidence_score: 60,
      metadata: {
        source: DEFAULT_SOURCE_NAME,
        poiName: truncate(record.poiName || null),
        queueId: record.id,
        utility: truncate(record.utility || null),
        region: record.region || null,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: DEFAULT_SOURCE_NAME,
      source_record_id: String(record.id),
      source_category: "energy",
      source_url: DEFAULT_SOURCE_PAGE,
      source_hash: sha256(JSON.stringify(record)),
      effective_date: observedAt,
      raw_payload: record,
      extraction_version: "queued-up-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "interconnection_queue_request",
      sector: "power_infrastructure",
      investment_amount: null,
      announcement_date: isoDate(record.qDate),
      construction_start: null,
      completion_estimate: isoDate(record.proposedDate),
      status: record.qStatus || "observed",
      metadata: {
        source: DEFAULT_SOURCE_NAME,
        queueId: record.id,
        utility: record.utility || null,
        region: record.region || null,
        service: record.service || null,
        typeClean: record.typeClean || null,
        capacityMw: safeNumber(record.capacityMw),
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      source_name: DEFAULT_SOURCE_NAME,
      dataset: "interconnection_queue",
      evidence_type: "interconnection_queue_observed",
      source_url: DEFAULT_SOURCE_PAGE,
      confidence_score: 76,
      observed_at: observedAt,
      raw_payload: record,
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "interconnection_capacity_requested",
      value: String(record.capacityMw),
      unit: "MW",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        source: DEFAULT_SOURCE_NAME,
        capacityMw: safeNumber(record.capacityMw),
        queueStatus: record.qStatus || null,
        utility: truncate(record.utility || null),
        typeClean: truncate(record.typeClean || null),
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:interconnection:${record.id}`),
      facility_id: facilityId,
      event_type: `queue_${record.qStatus || "observed"}`,
      occurred_at: observedAt,
      signal_id: signalId,
      metadata: {
        source: DEFAULT_SOURCE_NAME,
        queueId: record.id,
      },
    });

    bundle.programLinkRows.push({
      id: deterministicUuid(`program-link:interconnection:${record.id}`),
      facility_id: facilityId,
      program_type: "interconnection_queue",
      external_program_id: String(record.id),
      agency: truncate(record.utility || "Queued Up"),
      metadata: {
        source: DEFAULT_SOURCE_NAME,
        region: record.region || null,
        service: record.service || null,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:interconnection:${record.id}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "composite",
      score: "0.6700",
      features: {
        exactIdentifiers: [String(record.id)],
        sectorAlignment: true,
        capacityMw: safeNumber(record.capacityMw),
      },
      candidate_set: [facilityId],
      chosen: true,
      rationale:
        "Interconnection queue record mapped as infrastructure signal rather than monetized investment.",
    });
  }

  return bundle;
}
