import {
  DEFAULT_ECHO_ZIP_URL,
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  pickFirst,
  readCsvRowsFromZip,
  readIntEnv,
  readListEnv,
  sha256,
} from "./common.mjs";

function inferPermitProgram(row) {
  const joined = [
    pickFirst(row, ["cwa_permit_types", "caa_permit_types", "rcra_permit_types"]),
    pickFirst(row, ["npdes_ids"]),
    pickFirst(row, ["air_ids"]),
    pickFirst(row, ["rcra_ids"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (joined.includes("npdes") || joined.includes("water")) return "npdes";
  if (joined.includes("rcra") || joined.includes("hazard")) return "rcra";
  if (joined.includes("air")) return "air_permit";
  if (joined.includes("tri")) return "tri";
  return "echo";
}

export async function ingestEpaEcho(config = {}) {
  const zipUrl = config.zipUrl || process.env.ECHO_ZIP_URL || DEFAULT_ECHO_ZIP_URL;
  const states = readListEnv("INDUSTRIAL_TRACKER_INGEST_STATES", config.states || ["TX", "IL"]);
  const rowLimit = config.limit || readIntEnv("EPA_ECHO_LIMIT", 150);
  const rows = await readCsvRowsFromZip({
    zipUrl,
    filePatterns: [/echo.*\.csv$/i, /export.*\.csv$/i, /\.csv$/i],
    rowLimit,
    states,
    stateColumns: ["fac_state"],
  });

  const bundle = emptyBundle();

  for (const row of rows) {
    const frsId = pickFirst(row, ["frs id", "frs_id", "registry_id"]);
    const facilityName = pickFirst(row, ["fac_name", "facility_name", "facility name", "name"]);
    const stateCode = (pickFirst(row, ["fac_state", "facility_state", "state", "state_code"]) || "")
      .slice(0, 2)
      .toUpperCase();
    const countyFipsCandidate = pickFirst(row, ["fac_fips_code", "county_fips", "fips_code"]);
    const countyFips =
      countyFipsCandidate && /^\d{5}$/.test(countyFipsCandidate)
        ? countyFipsCandidate
        : null;
    const countyName = pickFirst(row, ["fac_county", "county_name", "county"]);
    const cbsaCandidate = pickFirst(row, ["fac_derived_cb2010", "cbsa_code"]);
    const cbsaCode = cbsaCandidate && /^\d{5}$/.test(cbsaCandidate) ? cbsaCandidate : null;

    if (!facilityName || !stateCode) continue;

    const facilityKey =
      frsId ||
      `${normalizeName(facilityName)}:${pickFirst(row, ["fac_city", "city", "facility_city"]) || ""}:${stateCode}`;
    const facilityId = deterministicUuid(`facility:echo:${facilityKey}`);
    const companyId = deterministicUuid(`entity:company:${normalizeName(facilityName)}`);
    const sourceNaturalId =
      pickFirst(row, ["registry_id", "frs id", "npdes_ids", "rcra_ids"]) || facilityKey;
    const sourceRecordId = deterministicUuid(`source:epa-echo:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:epa-echo:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:epa-echo:${sourceNaturalId}`);
    const permitId = deterministicUuid(`permit:epa-echo:${sourceNaturalId}`);
    const facilityEventId = deterministicUuid(`facility-event:epa-echo:${sourceNaturalId}`);
    const geoRow = buildGeoRow({
      countyFips,
      stateCode,
      countyName: countyName ? `${countyName}, ${stateCode}` : null,
      metadata: { source: "EPA ECHO" },
    });
    const geoId = geoRow?.id || null;
    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: facilityName,
      normalized_name: normalizeName(facilityName),
      entity_type: "company",
      country: "US",
      identifiers: frsId ? { frsId } : {},
      aliases: [],
      address: {
        city: pickFirst(row, ["fac_city", "city", "facility_city"]) || undefined,
        state: stateCode,
        countyFips: countyFips || undefined,
      },
      confidence_score: frsId ? 88 : 72,
      metadata: { source: "EPA ECHO" },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: facilityName,
      normalized_name: normalizeName(facilityName),
      address: {
        street1: pickFirst(row, ["fac_street", "address", "facility_address"]) || undefined,
        city: pickFirst(row, ["fac_city", "city", "facility_city"]) || undefined,
        state: stateCode,
        postalCode: pickFirst(row, ["fac_zip", "zip", "postal_code"]) || undefined,
        countyFips: countyFips || undefined,
      },
      latitude: pickFirst(row, ["fac_lat"]),
      longitude: pickFirst(row, ["fac_long"]),
      county_fips: countyFips,
      cbsa_code: cbsaCode,
      facility_source_ids: {
        ...(frsId ? { frsId } : {}),
        ...(pickFirst(row, ["npdes_ids"]) ? { npdesId: pickFirst(row, ["npdes_ids"]) } : {}),
        ...(pickFirst(row, ["rcra_ids"]) ? { rcraId: pickFirst(row, ["rcra_ids"]) } : {}),
      },
      confidence_score: frsId ? 88 : 70,
      metadata: { source: "EPA ECHO" },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: "EPA ECHO",
      source_record_id: sourceNaturalId,
      source_category: "permit",
      source_url: zipUrl,
      source_hash: sha256(JSON.stringify(row)),
      effective_date: isoDate(
        pickFirst(
          row,
          [
            "fac_date_last_inspection",
            "fac_date_last_formal_action",
            "fac_date_last_penalty",
            "fac_date_last_inspection_epa",
            "fac_date_last_inspection_state",
          ]
        )
      ),
      raw_payload: row,
      extraction_version: "epa-echo-v1",
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: null,
      source_name: "EPA ECHO",
      dataset: "echo_exporter",
      evidence_type: "permit_or_compliance_observed",
      source_url: zipUrl,
      confidence_score: frsId ? 90 : 78,
      observed_at:
        isoDate(
          pickFirst(
            row,
            [
              "fac_date_last_inspection",
              "fac_date_last_formal_action",
              "fac_date_last_penalty",
              "fac_date_last_inspection_epa",
              "fac_date_last_inspection_state",
            ]
          )
        ) ||
        new Date().toISOString(),
      raw_payload: row,
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: null,
      signal_type: "permit_status_observed",
      value:
        pickFirst(row, ["fac_compliance_status", "cwa_compliance_status", "rcra_compliance_status", "caa_compliance_status"]) || "observed",
      unit: null,
      evidence_id: evidenceId,
      observed_at:
        isoDate(
          pickFirst(
            row,
            [
              "fac_date_last_inspection",
              "fac_date_last_formal_action",
              "fac_date_last_penalty",
              "fac_date_last_inspection_epa",
              "fac_date_last_inspection_state",
            ]
          )
        ) ||
        new Date().toISOString(),
      metadata: {
        permitProgram: inferPermitProgram(row),
        violationStatus: pickFirst(row, ["fac_snc_flg", "cwa_snc_flag", "rcra_snc_flag", "caa_hpv_flag"]),
      },
    });

    bundle.permitRows.push({
      id: permitId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      geo_id: geoId,
      responsible_entity_id: companyId,
      permit_or_project_id:
        pickFirst(row, ["npdes_ids", "rcra_ids", "air_ids", "permit_id", "permit ids"]) || sourceNaturalId,
      event_type: "updated",
      event_date:
        isoDate(
          pickFirst(
            row,
            [
              "fac_date_last_inspection",
              "fac_date_last_formal_action",
              "fac_date_last_penalty",
              "fac_date_last_inspection_epa",
              "fac_date_last_inspection_state",
            ]
          )
        ) ||
        new Date().toISOString(),
      responsible_agency: "EPA",
      permit_program: inferPermitProgram(row),
      status:
        pickFirst(row, ["fac_compliance_status", "cwa_compliance_status", "rcra_compliance_status", "caa_compliance_status"]) || "observed",
      county_fips: countyFips,
      cbsa_code: cbsaCode,
      notes: pickFirst(row, ["fac_programs_with_snc", "fac_snc_flg", "cwa_3_yr_qncr_codes"]),
      metadata: row,
      confidence_score: frsId ? 88 : 74,
    });

    bundle.facilityEventRows.push({
      id: facilityEventId,
      facility_id: facilityId,
      event_type: "permit_status_updated",
      occurred_at:
        isoDate(
          pickFirst(
            row,
            [
              "fac_date_last_inspection",
              "fac_date_last_formal_action",
              "fac_date_last_penalty",
              "fac_date_last_inspection_epa",
              "fac_date_last_inspection_state",
            ]
          )
        ) ||
        new Date().toISOString(),
      signal_id: signalId,
      metadata: {
        source: "EPA ECHO",
        permitProgram: inferPermitProgram(row),
      },
    });
  }

  return bundle;
}
