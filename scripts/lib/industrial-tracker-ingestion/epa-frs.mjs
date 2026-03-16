import {
  DEFAULT_FRS_ZIP_URL,
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  pickFirst,
  readCsvRowsFromZip,
  readIntEnv,
  readListEnv,
  safeNumber,
  sha256,
} from "./common.mjs";

function programTypeFromAcronym(value) {
  const acronym = (value || "").toUpperCase();
  if (acronym.includes("NPDES")) return "npdes";
  if (acronym.includes("RCRA")) return "rcra";
  if (acronym.includes("TRIS") || acronym.includes("TRI")) return "tri";
  if (acronym.includes("RMP")) return "rmp";
  if (acronym.includes("GHG")) return "ghg";
  if (acronym.includes("AIR") || acronym === "CAA") return "air_permit";
  if (acronym.includes("SFDW") || acronym.includes("SDW")) return "drinking_water";
  if (acronym.includes("EIS")) return "eis";
  return acronym ? acronym.toLowerCase() : null;
}

export async function ingestEpaFrs(config = {}) {
  const zipUrl = config.zipUrl || process.env.FRS_ZIP_URL || DEFAULT_FRS_ZIP_URL;
  const states = readListEnv("INDUSTRIAL_TRACKER_INGEST_STATES", config.states || ["TX", "IL"]);
  const rowLimit = config.limit || readIntEnv("EPA_FRS_LIMIT", 150);
  const includeAuxiliary =
    config.includeAuxiliary ??
    String(process.env.EPA_FRS_INCLUDE_AUXILIARY || "").toLowerCase() === "true";
  const facilityRows = await readCsvRowsFromZip({
    zipUrl,
    filePatterns: [/FRS_FACILITIES\.csv$/i],
    rowLimit,
    states,
    stateColumns: ["fac_state"],
  });
  const programRows = includeAuxiliary
    ? await readCsvRowsFromZip({
        zipUrl,
        filePatterns: [/FRS_PROGRAM_LINKS\.csv$/i],
        rowLimit: null,
        states,
        stateColumns: ["state_code"],
      })
    : [];
  const naicsRows = includeAuxiliary
    ? await readCsvRowsFromZip({
        zipUrl,
        filePatterns: [/FRS_NAICS_CODES\.csv$/i],
        rowLimit: null,
        states: [],
        stateColumns: [],
      })
    : [];

  const bundle = emptyBundle();
  const programRowsByRegistryId = new Map();
  const naicsByRegistryId = new Map();
  const selectedRegistryIds = new Set(
    facilityRows
      .map((row) => pickFirst(row, ["registry_id"]))
      .filter(Boolean)
  );

  for (const row of programRows) {
    const registryId = pickFirst(row, ["registry_id"]);
    if (!registryId || !selectedRegistryIds.has(registryId)) continue;
    const list = programRowsByRegistryId.get(registryId) || [];
    list.push(row);
    programRowsByRegistryId.set(registryId, list);
  }

  for (const row of naicsRows) {
    const registryId = pickFirst(row, ["registry_id"]);
    const naicsCode = pickFirst(row, ["naics_code"]);
    if (!registryId || !naicsCode || !selectedRegistryIds.has(registryId)) continue;
    const list = naicsByRegistryId.get(registryId) || [];
    list.push(naicsCode);
    naicsByRegistryId.set(registryId, list);
  }

  for (const row of facilityRows) {
    const frsId = pickFirst(row, ["registry_id"]);
    const facilityName = pickFirst(row, [
      "fac_name",
      "facility_name",
      "primary_name",
    ]);
    const stateCode = pickFirst(row, ["fac_state", "state_code", "state"]);

    if (!frsId || !facilityName || !stateCode) continue;

    const countyName = pickFirst(row, ["fac_county", "county_name"]);
    const geoRow = buildGeoRow({
      countyFips: null,
      stateCode,
      countyName: countyName ? `${countyName}, ${stateCode}` : null,
      metadata: { source: "EPA FRS" },
    });
    const geoId = geoRow?.id || null;
    if (geoRow) bundle.geoRows.push(geoRow);

    const companyName =
      pickFirst(row, ["parent_company_name", "org_name", "organization_name"]) || facilityName;
    const companyId = deterministicUuid(`entity:company:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:frs:${frsId}`);
    const sourceRecordId = deterministicUuid(`source:epa-frs:${frsId}`);
    const evidenceId = deterministicUuid(`evidence:epa-frs:${frsId}`);
    const signalId = deterministicUuid(`signal:epa-frs:${frsId}:facility_registry_presence`);
    const eventId = deterministicUuid(`facility-event:epa-frs:${frsId}`);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: facilityName !== companyName ? [facilityName] : [],
      address: {
        street1: pickFirst(row, ["fac_street"]) || undefined,
        city: pickFirst(row, ["fac_city"]) || undefined,
        state: stateCode,
        postalCode: pickFirst(row, ["fac_zip"]) || undefined,
      },
      confidence_score: 86,
      metadata: { source: "EPA FRS" },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: facilityName,
      normalized_name: normalizeName(facilityName),
      address: {
        street1: pickFirst(row, ["fac_street"]) || undefined,
        city: pickFirst(row, ["fac_city"]) || undefined,
        state: stateCode,
        postalCode: pickFirst(row, ["fac_zip"]) || undefined,
      },
      latitude: safeNumber(pickFirst(row, ["latitude_measure"])),
      longitude: safeNumber(pickFirst(row, ["longitude_measure"])),
      county_fips: null,
      cbsa_code: null,
      facility_source_ids: { frsId },
      confidence_score: 95,
      metadata: { source: "EPA FRS" },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: "EPA FRS",
      source_record_id: frsId,
      source_category: "permit",
      source_url: zipUrl,
      source_hash: sha256(JSON.stringify(row)),
      effective_date: null,
      raw_payload: row,
      extraction_version: "epa-frs-v1",
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: null,
      source_name: "EPA Facility Registry Service",
      dataset: "national_combined_file",
      evidence_type: "facility_registry_observed",
      source_url: zipUrl,
      confidence_score: 96,
      observed_at: new Date().toISOString(),
      raw_payload: {
        facility: row,
        programs: programRowsByRegistryId.get(frsId) || [],
        naicsCodes: naicsByRegistryId.get(frsId) || [],
      },
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: null,
      signal_type: "facility_registry_presence",
      value: (naicsByRegistryId.get(frsId) || [])[0] || null,
      unit: null,
      evidence_id: evidenceId,
      observed_at: new Date().toISOString(),
      metadata: {
        dataset: "EPA FRS",
        auxiliaryLoaded: includeAuxiliary,
        naicsCodes: naicsByRegistryId.get(frsId) || [],
      },
    });

    bundle.facilityEventRows.push({
      id: eventId,
      facility_id: facilityId,
      event_type: "facility_registered",
      occurred_at: new Date().toISOString(),
      signal_id: signalId,
      metadata: {
        source: "EPA FRS",
        frsId,
      },
    });

    for (const programRow of programRowsByRegistryId.get(frsId) || []) {
      const programAcronym = pickFirst(programRow, ["pgm_sys_acrnm", "program_acronym"]);
      const externalProgramId = pickFirst(programRow, ["pgm_sys_id", "program_system_id"]);
      const programType = programTypeFromAcronym(programAcronym);

      if (programType && externalProgramId) {
        bundle.programLinkRows.push({
          id: deterministicUuid(`program:${facilityId}:${programType}:${externalProgramId}`),
          facility_id: facilityId,
          program_type: programType,
          external_program_id: externalProgramId,
          agency: "EPA",
          metadata: {
            source: "EPA FRS",
            programAcronym,
            address: pickFirst(programRow, ["location_address"]),
            countyName: pickFirst(programRow, ["county_name"]),
          },
        });
      }
    }

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:epa-frs:${frsId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: "0.9900",
      features: {
        exactIdentifiers: ["frs_id"],
        nameSimilarity: 1,
        addressMatch: 1,
        domainMatch: false,
        geoDistanceKm: 0,
        sectorAlignment: Boolean((naicsByRegistryId.get(frsId) || [])[0]),
      },
      candidate_set: [facilityId],
      chosen: true,
      rationale: "Matched facility on EPA FRS registry identifier.",
    });
  }

  return bundle;
}
