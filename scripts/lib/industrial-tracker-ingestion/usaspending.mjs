import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  formatCountyFips,
  isoDate,
  normalizeName,
  pickFirst,
  safeNumber,
  sha256,
  techTagsFromText,
} from "./common.mjs";

const USA_SPENDING_ENDPOINT =
  "https://api.usaspending.gov/api/v2/search/spending_by_award/";

const AWARD_TYPE_GROUPS = {
  contracts: ["A", "B", "C", "D"],
  grants: ["02", "03", "04", "05", "F001", "F002"],
  loans: ["07", "08", "F003", "F004"],
  other_financial_assistance: ["06", "10", "F006", "F007"],
  direct_payments: ["11", "F010"],
};

const DEFAULT_FIELDS = [
  "Award ID",
  "Recipient Name",
  "Recipient UEI",
  "Award Amount",
  "Award Type",
  "Awarding Agency",
  "Awarding Sub Agency",
  "Action Date",
  "Last Modified Date",
  "Base Obligation Date",
  "Start Date",
  "End Date",
  "Description",
  "NAICS Code",
  "NAICS Description",
  "PSC Code",
  "Place of Performance State Code",
  "Place of Performance County Code",
  "Place of Performance County Name",
  "Recipient State Code",
  "Recipient City Name",
  "Recipient Zip5",
];

const INDUSTRIAL_NAICS_PREFIXES = [
  "11",
  "21",
  "22",
  "23",
  "31",
  "32",
  "33",
  "42",
  "48",
  "49",
];

const INDUSTRIAL_KEYWORDS = [
  "advanced manufacturing",
  "assembly",
  "battery",
  "chemical",
  "construction",
  "critical mineral",
  "data center",
  "distribution",
  "electronics",
  "energy",
  "facility",
  "fab",
  "fabrication",
  "factory",
  "forging",
  "freight",
  "generator",
  "grid",
  "industrial",
  "infrastructure",
  "logistics",
  "manufacturing",
  "mine",
  "mining",
  "nuclear",
  "packaging",
  "plant",
  "port",
  "power",
  "processing",
  "production",
  "rail",
  "refinery",
  "semiconductor",
  "shipyard",
  "smelter",
  "substation",
  "supply chain",
  "transformer",
  "transmission",
  "utility",
  "wafer",
  "warehouse",
];

const DISQUALIFYING_KEYWORDS = [
  "board of education",
  "college",
  "community college",
  "hospital",
  "independent school district",
  "medicaid",
  "pension",
  "public schools",
  "retirement system",
  "school district",
  "student aid",
  "university",
];

const STRONG_ASSET_KEYWORDS = [
  "assembly",
  "battery",
  "data center",
  "fab",
  "fabrication",
  "factory",
  "facility",
  "generator",
  "grid",
  "manufacturing",
  "mine",
  "mining",
  "nuclear",
  "plant",
  "port",
  "power",
  "processing",
  "rail",
  "refinery",
  "semiconductor",
  "shipyard",
  "smelter",
  "substation",
  "transformer",
  "transmission",
  "utility",
  "warehouse",
];

function buildRequestBody(config) {
  const startDate =
    config.startDate ||
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endDate = config.endDate || new Date().toISOString().slice(0, 10);

  return {
    fields: DEFAULT_FIELDS,
    page: 1,
    limit: config.limit || 25,
    sort: config.sortField || "Last Modified Date",
    order: "desc",
    subawards: false,
    filters: {
      award_type_codes: config.awardTypeCodes,
      time_period: [{ start_date: startDate, end_date: endDate }],
      place_of_performance_locations: [{ country: "USA" }],
    },
  };
}

function isIndustrialAward({ description, naicsCode, naicsDescription, recipientName, awardingAgency, programName }) {
  const normalizedNaics = String(naicsCode || "").trim();
  if (INDUSTRIAL_NAICS_PREFIXES.some((prefix) => normalizedNaics.startsWith(prefix))) {
    return true;
  }

  const haystack = [
    description,
    naicsDescription,
    recipientName,
    awardingAgency,
    programName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasStrongAssetKeyword = STRONG_ASSET_KEYWORDS.some((keyword) =>
    haystack.includes(keyword)
  );
  const hasDisqualifyingKeyword = DISQUALIFYING_KEYWORDS.some((keyword) =>
    haystack.includes(keyword)
  );

  if (hasDisqualifyingKeyword && !hasStrongAssetKeyword) {
    return false;
  }

  return INDUSTRIAL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export async function ingestUsaSpending(config = {}) {
  const bundle = emptyBundle();
  const groupNames =
    config.awardTypeGroups || [
      "contracts",
      "grants",
      "loans",
      "other_financial_assistance",
    ];
  const results = [];

  for (const groupName of groupNames) {
    const awardTypeCodes = AWARD_TYPE_GROUPS[groupName];
    if (!awardTypeCodes) {
      throw new Error(`Unsupported USAspending award type group: ${groupName}`);
    }

    const response = await fetch(USA_SPENDING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildRequestBody({
          ...config,
          awardTypeCodes,
          sortField: groupName === "contracts" ? "Last Modified Date" : "Last Modified Date",
        })
      ),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`USAspending ingest failed for ${groupName}: ${response.status} ${text}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload.results)) {
      results.push(...payload.results);
    }
  }

  for (const rawRow of results) {
    const row =
      rawRow && typeof rawRow === "object"
        ? Object.fromEntries(
            Object.entries(rawRow).map(([key, value]) => [key.toLowerCase(), value])
          )
        : {};
    const awardId = pickFirst(row, ["award id", "generated internal id", "internal id"]);
    const recipientName = pickFirst(row, ["recipient name"]);

    if (!awardId || !recipientName) continue;

    const recipientUei = pickFirst(row, ["recipient uei"]);
    const awardingAgency = pickFirst(row, ["awarding agency", "awarding agency name"]);
    const countyFips = formatCountyFips(
      pickFirst(row, ["place of performance state code"]),
      pickFirst(row, ["place of performance county code"])
    );
    const stateCode = pickFirst(row, ["place of performance state code"]);
    const geoRow = buildGeoRow({
      countyFips,
      stateCode,
      countyName: pickFirst(row, ["place of performance county name"])
        ? `${pickFirst(row, ["place of performance county name"])}, ${stateCode}`
        : null,
      metadata: { source: "USAspending" },
    });
    const geoId = geoRow?.id || null;
    if (geoRow) bundle.geoRows.push(geoRow);

    const providerEntityId = deterministicUuid(
      `entity:agency:${normalizeName(awardingAgency || "unknown")}`
    );
    const recipientEntityId = deterministicUuid(
      `entity:recipient:${recipientUei || normalizeName(recipientName)}`
    );
    const sourceRecordId = deterministicUuid(`source:usaspending:${awardId}`);
    const evidenceId = deterministicUuid(`evidence:usaspending:${awardId}`);
    const eventId = deterministicUuid(`investment:usaspending:${awardId}`);
    const projectId = deterministicUuid(`project:usaspending:${awardId}`);
    const actionDate =
      isoDate(pickFirst(row, ["action date", "base obligation date", "last modified date"])) ||
      new Date().toISOString();
    const amount = safeNumber(pickFirst(row, ["award amount"])) || 0;
    const description = pickFirst(row, ["description"]);
    const naicsCode = pickFirst(row, ["naics code"]);
    const naicsDescription = pickFirst(row, ["naics description"]);
    const programName = pickFirst(row, ["awarding sub agency"]);

    if (
      !isIndustrialAward({
        description,
        naicsCode,
        naicsDescription,
        recipientName,
        awardingAgency,
        programName,
      })
    ) {
      continue;
    }

    const shouldCreateProject = amount >= (config.projectThresholdUsd || 50_000_000);

    bundle.entityRows.push(
      {
        id: providerEntityId,
        legal_name: awardingAgency || "Unknown agency",
        normalized_name: normalizeName(awardingAgency || "unknown agency"),
        entity_type: "agency",
        country: "US",
        identifiers: {},
        aliases: [],
        confidence_score: 95,
        metadata: { source: "USAspending" },
      },
      {
        id: recipientEntityId,
        legal_name: recipientName,
        normalized_name: normalizeName(recipientName),
        entity_type: "recipient",
        country: "US",
        identifiers: recipientUei ? { uei: recipientUei } : {},
        aliases: [],
        address: {
          city: pickFirst(row, ["recipient city name"]) || undefined,
          state: pickFirst(row, ["recipient state code"]) || undefined,
          postalCode: pickFirst(row, ["recipient zip5"]) || undefined,
        },
        confidence_score: recipientUei ? 94 : 80,
        metadata: { source: "USAspending" },
      }
    );

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: "USAspending",
      source_record_id: awardId,
      source_category: "federal_award",
      source_url: null,
      source_hash: sha256(JSON.stringify(rawRow)),
      effective_date: actionDate,
      raw_payload: rawRow,
      extraction_version: "usaspending-v1",
    });

    bundle.investmentRows.push({
      id: eventId,
      source_record_id: sourceRecordId,
      provider_entity_id: providerEntityId,
      recipient_entity_id: recipientEntityId,
      facility_id: null,
      geo_id: geoId,
      taxonomy_id: null,
      event_type: "federal_award",
      amount,
      amount_type: "obligation",
      currency: "USD",
      announced_date: actionDate,
      action_date: actionDate,
      start_date: isoDate(pickFirst(row, ["start date"])),
      end_date: isoDate(pickFirst(row, ["end date"])),
      provider_name: awardingAgency,
      recipient_name: recipientName,
      program_name: programName,
      award_type: pickFirst(row, ["award type"]),
      sector_naics: naicsCode,
      psc_code: pickFirst(row, ["psc code"]),
      tech_tags: techTagsFromText(description, naicsDescription),
      jobs_estimate: null,
      capex_estimate: null,
      county_fips: countyFips,
      cbsa_code: null,
      place_of_performance: {
        stateCode,
        countyFips,
        countyName: pickFirst(row, ["place of performance county name"]),
      },
      recipient_location: {
        city: pickFirst(row, ["recipient city name"]),
        state: pickFirst(row, ["recipient state code"]),
        postalCode: pickFirst(row, ["recipient zip5"]),
      },
      confidence_score: recipientUei ? 93 : 84,
      provenance: {
        matchedEntityStrategy: recipientUei ? "uei" : "recipient_name",
        matchedFacilityStrategy: "none",
        notes: ["Award-level federal obligation from USAspending."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: null,
      company_id: recipientEntityId,
      geo_id: geoId,
      project_id: shouldCreateProject ? projectId : null,
      source_name: "USAspending.gov",
      dataset: "spending_by_award",
      evidence_type: "federal_award_observed",
      source_url: null,
      confidence_score: 93,
      observed_at: actionDate,
      raw_payload: rawRow,
    });

    if (shouldCreateProject) {
      bundle.projectRows.push({
        id: projectId,
        facility_id: null,
        company_id: recipientEntityId,
        geo_id: geoId,
        project_type: "public_funding",
        sector: naicsDescription || naicsCode || "industrial",
        investment_amount: amount,
        announcement_date: actionDate,
        construction_start: isoDate(pickFirst(row, ["start date"])),
        completion_estimate: isoDate(pickFirst(row, ["end date"])),
        status: "observed",
        metadata: {
          source: "USAspending",
          awardId,
          description,
        },
      });
    }

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:usaspending:${awardId}`),
      source_record_id: sourceRecordId,
      entity_id: recipientEntityId,
      facility_id: null,
      decision_type: recipientUei ? "deterministic" : "composite",
      score: recipientUei ? "0.9800" : "0.7600",
      features: {
        exactIdentifiers: recipientUei ? ["uei"] : [],
        nameSimilarity: recipientUei ? 1 : 0.76,
        addressMatch: 0,
        domainMatch: false,
        geoDistanceKm: null,
        sectorAlignment: Boolean(naicsCode && /^(31|32|33)/.test(naicsCode)),
      },
      candidate_set: [recipientEntityId],
      chosen: true,
      rationale: recipientUei
        ? "Matched recipient via UEI."
        : "Matched recipient via normalized legal name.",
    });
  }

  return bundle;
}
