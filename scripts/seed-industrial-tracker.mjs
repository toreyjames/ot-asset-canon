const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl && !(supabaseUrl && serviceRoleKey)) {
  console.error(
    "DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY is required to seed Industrial Tracker data."
  );
  process.exit(1);
}

const ids = {
  geoDallas: "00000000-0000-4000-8000-000000000101",
  geoHarris: "00000000-0000-4000-8000-000000000102",
  geoCook: "00000000-0000-4000-8000-000000000103",
  entityDoe: "00000000-0000-4000-8000-000000000201",
  entityNist: "00000000-0000-4000-8000-000000000202",
  entityGulfChem: "00000000-0000-4000-8000-000000000203",
  entityNorthCircuit: "00000000-0000-4000-8000-000000000204",
  entityGreatLakes: "00000000-0000-4000-8000-000000000205",
  facilityHouston: "00000000-0000-4000-8000-000000000301",
  facilityDallas: "00000000-0000-4000-8000-000000000302",
  facilityChicago: "00000000-0000-4000-8000-000000000303",
  source1: "00000000-0000-4000-8000-000000000401",
  source2: "00000000-0000-4000-8000-000000000402",
  source3: "00000000-0000-4000-8000-000000000403",
  source4: "00000000-0000-4000-8000-000000000404",
  source5: "00000000-0000-4000-8000-000000000405",
  project1: "00000000-0000-4000-8000-000000000451",
  project2: "00000000-0000-4000-8000-000000000452",
  project3: "00000000-0000-4000-8000-000000000453",
  event1: "00000000-0000-4000-8000-000000000501",
  event2: "00000000-0000-4000-8000-000000000502",
  event3: "00000000-0000-4000-8000-000000000503",
  event4: "00000000-0000-4000-8000-000000000504",
  permit1: "00000000-0000-4000-8000-000000000601",
  permit2: "00000000-0000-4000-8000-000000000602",
  permit3: "00000000-0000-4000-8000-000000000603",
  evidence1: "00000000-0000-4000-8000-000000000701",
  evidence2: "00000000-0000-4000-8000-000000000702",
  evidence3: "00000000-0000-4000-8000-000000000703",
  signal1: "00000000-0000-4000-8000-000000000801",
  signal2: "00000000-0000-4000-8000-000000000802",
  signal3: "00000000-0000-4000-8000-000000000803",
  facilityEvent1: "00000000-0000-4000-8000-000000000901",
  facilityEvent2: "00000000-0000-4000-8000-000000000902",
  facilityEvent3: "00000000-0000-4000-8000-000000000903",
  hypothesis1: "00000000-0000-4000-8000-000000001001",
  hypothesis2: "00000000-0000-4000-8000-000000001002",
  hypothesis3: "00000000-0000-4000-8000-000000001003",
};

async function supabaseFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase seed request failed: ${response.status} ${text}`);
  }
}

async function deleteByIds(table, values) {
  await supabaseFetch(`${table}?id=in.(${values.join(",")})`, { method: "DELETE" });
}

async function upsert(table, rows, onConflict) {
  const normalizedRows = normalizeRows(rows);
  await supabaseFetch(`${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(normalizedRows),
  });
}

async function insert(table, rows) {
  const normalizedRows = normalizeRows(rows);
  await supabaseFetch(table, {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(normalizedRows),
  });
}

function normalizeRows(rows) {
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  return rows.map((row) =>
    Object.fromEntries(keys.map((key) => [key, key in row ? row[key] : null]))
  );
}

async function seedViaSupabase() {
  await deleteByIds("model_hypotheses", [ids.hypothesis1, ids.hypothesis2, ids.hypothesis3]);
  await deleteByIds("facility_events", [ids.facilityEvent1, ids.facilityEvent2, ids.facilityEvent3]);
  await deleteByIds("derived_signals", [ids.signal1, ids.signal2, ids.signal3]);
  await deleteByIds("evidence_records", [ids.evidence1, ids.evidence2, ids.evidence3]);
  await supabaseFetch(
    `program_links?facility_id=in.(${ids.facilityHouston},${ids.facilityDallas},${ids.facilityChicago})`,
    { method: "DELETE" }
  );
  await deleteByIds("facility_master", [ids.facilityHouston, ids.facilityDallas, ids.facilityChicago]);
  await deleteByIds("entity_master", [
    ids.entityDoe,
    ids.entityNist,
    ids.entityGulfChem,
    ids.entityNorthCircuit,
    ids.entityGreatLakes,
  ]);
  await deleteByIds("source_records", [ids.source1, ids.source2, ids.source3, ids.source4, ids.source5]);
  await deleteByIds("industrial_projects", [ids.project1, ids.project2, ids.project3]);
  await deleteByIds("permit_or_milestone_events", [ids.permit1, ids.permit2, ids.permit3]);
  await deleteByIds("investment_events", [ids.event1, ids.event2, ids.event3, ids.event4]);

  await upsert("geo_dim", [
    {
      id: ids.geoDallas,
      county_fips: "48113",
      state_fips: "48",
      cbsa_code: "19100",
      state_code: "TX",
      county_name: "Dallas County, TX",
      cbsa_name: "Dallas-Fort Worth-Arlington, TX",
      population: 2600000,
      manufacturing_employment: 106800,
      establishment_count: 1845,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.geoHarris,
      county_fips: "48201",
      state_fips: "48",
      cbsa_code: "26420",
      state_code: "TX",
      county_name: "Harris County, TX",
      cbsa_name: "Houston-Pasadena-The Woodlands, TX",
      population: 4900000,
      manufacturing_employment: 113600,
      establishment_count: 1965,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.geoCook,
      county_fips: "17031",
      state_fips: "17",
      cbsa_code: "16980",
      state_code: "IL",
      county_name: "Cook County, IL",
      cbsa_name: "Chicago-Naperville-Elgin, IL-IN-WI",
      population: 5200000,
      manufacturing_employment: 125300,
      establishment_count: 1777,
      metadata: { seed: "industrial-tracker" },
    },
  ], "county_fips");

  await insert("entity_master", [
    {
      id: ids.entityDoe,
      legal_name: "U.S. Department of Energy",
      normalized_name: "u s department of energy",
      entity_type: "agency",
      country: "US",
      website_domain: "energy.gov",
      identifiers: { agency: "DOE" },
      aliases: ["DOE"],
      confidence_score: 100,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.entityNist,
      legal_name: "National Institute of Standards and Technology",
      normalized_name: "national institute of standards and technology",
      entity_type: "agency",
      country: "US",
      website_domain: "nist.gov",
      identifiers: { agency: "NIST" },
      aliases: ["NIST"],
      confidence_score: 100,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.entityGulfChem,
      legal_name: "GulfChem Manufacturing LLC",
      normalized_name: "gulfchem manufacturing llc",
      entity_type: "company",
      country: "US",
      website_domain: "gulfchem.example",
      identifiers: { uei: "GULFCHEM123" },
      aliases: ["GulfChem"],
      confidence_score: 92,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.entityNorthCircuit,
      legal_name: "North Circuit Systems Inc.",
      normalized_name: "north circuit systems inc",
      entity_type: "company",
      country: "US",
      website_domain: "northcircuit.example",
      identifiers: { uei: "NORTHCIR123" },
      aliases: ["North Circuit"],
      confidence_score: 91,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.entityGreatLakes,
      legal_name: "Great Lakes Retrofit Group",
      normalized_name: "great lakes retrofit group",
      entity_type: "company",
      country: "US",
      website_domain: "greatlakesretrofit.example",
      identifiers: { uei: "GLRG123456" },
      aliases: ["GL Retrofit"],
      confidence_score: 89,
      metadata: { seed: "industrial-tracker" },
    },
  ]);

  await insert("facility_master", [
    {
      id: ids.facilityHouston,
      entity_id: ids.entityGulfChem,
      geo_id: ids.geoHarris,
      facility_name: "GulfChem Houston Complex",
      normalized_name: "gulfchem houston complex",
      address: { city: "Houston", state: "TX", countyFips: "48201" },
      latitude: 29.7604,
      longitude: -95.3698,
      county_fips: "48201",
      cbsa_code: "26420",
      facility_source_ids: { frsId: "110000000001" },
      confidence_score: 93,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.facilityDallas,
      entity_id: ids.entityNorthCircuit,
      geo_id: ids.geoDallas,
      facility_name: "North Circuit Assembly Campus",
      normalized_name: "north circuit assembly campus",
      address: { city: "Dallas", state: "TX", countyFips: "48113" },
      latitude: 32.7767,
      longitude: -96.797,
      county_fips: "48113",
      cbsa_code: "19100",
      facility_source_ids: { samUei: "NORTHCIR123" },
      confidence_score: 91,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.facilityChicago,
      entity_id: ids.entityGreatLakes,
      geo_id: ids.geoCook,
      facility_name: "Great Lakes Retrofit Works",
      normalized_name: "great lakes retrofit works",
      address: { city: "Chicago", state: "IL", countyFips: "17031" },
      latitude: 41.8781,
      longitude: -87.6298,
      county_fips: "17031",
      cbsa_code: "16980",
      facility_source_ids: { frsId: "110000000003" },
      confidence_score: 88,
      metadata: { seed: "industrial-tracker" },
    },
  ]);

  await insert("source_records", [
    {
      id: ids.source1,
      source_system: "usaspending",
      source_record_id: "award-houston-demo-001",
      source_category: "federal_award",
      source_url: "https://www.usaspending.gov",
      source_hash: "seed-award-1",
      effective_date: "2026-03-06T00:00:00.000Z",
      raw_payload: { seed: "industrial-tracker", kind: "award" },
      extraction_version: "seed-v1",
    },
    {
      id: ids.source2,
      source_system: "usaspending",
      source_record_id: "award-dallas-demo-001",
      source_category: "federal_award",
      source_url: "https://www.usaspending.gov",
      source_hash: "seed-award-2",
      effective_date: "2026-03-04T00:00:00.000Z",
      raw_payload: { seed: "industrial-tracker", kind: "award" },
      extraction_version: "seed-v1",
    },
    {
      id: ids.source3,
      source_system: "sec-edgar",
      source_record_id: "filing-chicago-demo-001",
      source_category: "filing",
      source_url: "https://www.sec.gov/edgar",
      source_hash: "seed-filing-1",
      effective_date: "2026-03-01T00:00:00.000Z",
      raw_payload: { seed: "industrial-tracker", kind: "filing" },
      extraction_version: "seed-v1",
    },
    {
      id: ids.source4,
      source_system: "epa-echo",
      source_record_id: "permit-houston-demo-001",
      source_category: "permit",
      source_url: "https://echo.epa.gov",
      source_hash: "seed-permit-1",
      effective_date: "2026-03-02T00:00:00.000Z",
      raw_payload: { seed: "industrial-tracker", kind: "permit" },
      extraction_version: "seed-v1",
    },
    {
      id: ids.source5,
      source_system: "permitting-dashboard",
      source_record_id: "milestone-dallas-demo-001",
      source_category: "permit",
      source_url: "https://www.permits.performance.gov",
      source_hash: "seed-permit-2",
      effective_date: "2026-03-03T00:00:00.000Z",
      raw_payload: { seed: "industrial-tracker", kind: "milestone" },
      extraction_version: "seed-v1",
    },
  ]);

  await insert("industrial_projects", [
    {
      id: ids.project1,
      facility_id: ids.facilityHouston,
      company_id: ids.entityGulfChem,
      geo_id: ids.geoHarris,
      project_type: "expansion",
      sector: "petrochemical",
      investment_amount: 2100000000,
      announcement_date: "2026-03-02T00:00:00.000Z",
      construction_start: "2026-06-01T00:00:00.000Z",
      completion_estimate: "2028-03-01T00:00:00.000Z",
      status: "announced",
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.project2,
      facility_id: ids.facilityDallas,
      company_id: ids.entityNorthCircuit,
      geo_id: ids.geoDallas,
      project_type: "new_build",
      sector: "electronics",
      investment_amount: 1800000000,
      announcement_date: "2026-02-28T00:00:00.000Z",
      construction_start: "2026-05-15T00:00:00.000Z",
      completion_estimate: "2027-12-01T00:00:00.000Z",
      status: "announced",
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.project3,
      facility_id: ids.facilityChicago,
      company_id: ids.entityGreatLakes,
      geo_id: ids.geoCook,
      project_type: "modernization",
      sector: "industrial-retrofit",
      investment_amount: 910000000,
      announcement_date: "2026-02-26T00:00:00.000Z",
      construction_start: "2026-04-01T00:00:00.000Z",
      completion_estimate: "2027-06-01T00:00:00.000Z",
      status: "planned",
      metadata: { seed: "industrial-tracker" },
    },
  ]);

  await insert("investment_events", [
    {
      id: ids.event1,
      source_record_id: ids.source1,
      provider_entity_id: ids.entityDoe,
      recipient_entity_id: ids.entityGulfChem,
      facility_id: ids.facilityHouston,
      geo_id: ids.geoHarris,
      event_type: "financing_commitment",
      amount: 1380000000,
      amount_type: "commitment",
      currency: "USD",
      announced_date: "2026-03-02T00:00:00.000Z",
      action_date: "2026-03-06T00:00:00.000Z",
      provider_name: "U.S. Department of Energy",
      recipient_name: "GulfChem Manufacturing LLC",
      program_name: "Industrial Energy Transition",
      award_type: "loan commitment",
      sector_naics: "325110",
      tech_tags: ["petrochemical", "energy-transition"],
      jobs_estimate: 1640,
      capex_estimate: 2100000000,
      county_fips: "48201",
      cbsa_code: "26420",
      confidence_score: 94,
      provenance: { matchedEntityStrategy: "uei", matchedFacilityStrategy: "frs" },
    },
    {
      id: ids.event2,
      source_record_id: ids.source2,
      provider_entity_id: ids.entityNist,
      recipient_entity_id: ids.entityNorthCircuit,
      facility_id: ids.facilityDallas,
      geo_id: ids.geoDallas,
      event_type: "federal_award",
      amount: 1210000000,
      amount_type: "obligation",
      currency: "USD",
      announced_date: "2026-02-28T00:00:00.000Z",
      action_date: "2026-03-04T00:00:00.000Z",
      provider_name: "National Institute of Standards and Technology",
      recipient_name: "North Circuit Systems Inc.",
      program_name: "Domestic Electronics Capacity",
      award_type: "grant",
      sector_naics: "334413",
      tech_tags: ["electronics", "assembly"],
      jobs_estimate: 1390,
      capex_estimate: 1800000000,
      county_fips: "48113",
      cbsa_code: "19100",
      confidence_score: 96,
      provenance: { matchedEntityStrategy: "uei", matchedFacilityStrategy: "address" },
    },
    {
      id: ids.event3,
      source_record_id: ids.source3,
      recipient_entity_id: ids.entityGreatLakes,
      facility_id: ids.facilityChicago,
      geo_id: ids.geoCook,
      event_type: "capex_announcement",
      amount: 910000000,
      amount_type: "estimate",
      currency: "USD",
      announced_date: "2026-02-26T00:00:00.000Z",
      action_date: "2026-03-01T00:00:00.000Z",
      recipient_name: "Great Lakes Retrofit Group",
      program_name: "Industrial Retrofit Program",
      award_type: "capex announcement",
      sector_naics: "333999",
      tech_tags: ["retrofit", "industrial-upgrade"],
      jobs_estimate: 980,
      capex_estimate: 910000000,
      county_fips: "17031",
      cbsa_code: "16980",
      confidence_score: 81,
      provenance: { matchedEntityStrategy: "cik", matchedFacilityStrategy: "address" },
    },
    {
      id: ids.event4,
      source_record_id: ids.source2,
      provider_entity_id: ids.entityNist,
      recipient_entity_id: ids.entityNorthCircuit,
      facility_id: ids.facilityDallas,
      geo_id: ids.geoDallas,
      event_type: "incentive_award",
      amount: 420000000,
      amount_type: "commitment",
      currency: "USD",
      announced_date: "2026-03-03T00:00:00.000Z",
      action_date: "2026-03-04T00:00:00.000Z",
      provider_name: "National Institute of Standards and Technology",
      recipient_name: "North Circuit Systems Inc.",
      program_name: "Regional Supply Chain Buildout",
      award_type: "state incentive",
      sector_naics: "334413",
      tech_tags: ["electronics", "supply-chain"],
      jobs_estimate: 520,
      capex_estimate: 650000000,
      county_fips: "48113",
      cbsa_code: "19100",
      confidence_score: 84,
      provenance: { matchedEntityStrategy: "uei", matchedFacilityStrategy: "address" },
    },
  ]);

  await insert("permit_or_milestone_events", [
    {
      id: ids.permit1,
      source_record_id: ids.source4,
      facility_id: ids.facilityHouston,
      geo_id: ids.geoHarris,
      responsible_entity_id: ids.entityDoe,
      permit_or_project_id: "permit-houston-001",
      event_type: "issued",
      event_date: "2026-03-02T00:00:00.000Z",
      responsible_agency: "EPA Region 6",
      permit_program: "NPDES",
      status: "active",
      county_fips: "48201",
      cbsa_code: "26420",
      notes: "Wastewater permit updated for expansion phase.",
      confidence_score: 90,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.permit2,
      source_record_id: ids.source5,
      facility_id: ids.facilityDallas,
      geo_id: ids.geoDallas,
      responsible_entity_id: ids.entityNist,
      permit_or_project_id: "fast41-dallas-001",
      event_type: "milestone",
      event_date: "2026-03-03T00:00:00.000Z",
      responsible_agency: "Permitting Dashboard",
      permit_program: "FAST-41",
      status: "on-track",
      county_fips: "48113",
      cbsa_code: "19100",
      notes: "Interagency permitting milestone recorded.",
      confidence_score: 93,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.permit3,
      source_record_id: ids.source3,
      facility_id: ids.facilityChicago,
      geo_id: ids.geoCook,
      responsible_entity_id: ids.entityGreatLakes,
      permit_or_project_id: "retrofit-chicago-001",
      event_type: "filed",
      event_date: "2026-02-27T00:00:00.000Z",
      responsible_agency: "Illinois EPA",
      permit_program: "RCRA",
      status: "submitted",
      county_fips: "17031",
      cbsa_code: "16980",
      notes: "Retrofit waste handling update filed.",
      confidence_score: 82,
      metadata: { seed: "industrial-tracker" },
    },
  ]);

  await upsert("program_links", [
    {
      facility_id: ids.facilityHouston,
      program_type: "npdes",
      external_program_id: "TXNPDES-001",
      agency: "EPA Region 6",
      metadata: { seed: "industrial-tracker" },
    },
    {
      facility_id: ids.facilityDallas,
      program_type: "air_permit",
      external_program_id: "TXAIR-001",
      agency: "Texas Commission on Environmental Quality",
      metadata: { seed: "industrial-tracker" },
    },
    {
      facility_id: ids.facilityChicago,
      program_type: "rcra",
      external_program_id: "ILRCRA-001",
      agency: "Illinois EPA",
      metadata: { seed: "industrial-tracker" },
    },
  ], "facility_id,program_type,external_program_id");

  await insert("evidence_records", [
    {
      id: ids.evidence1,
      source_record_id: ids.source4,
      facility_id: ids.facilityHouston,
      company_id: ids.entityGulfChem,
      geo_id: ids.geoHarris,
      project_id: ids.project1,
      source_name: "EPA ECHO",
      dataset: "EPA permit",
      evidence_type: "permit_issued",
      source_url: "https://echo.epa.gov",
      confidence_score: 91,
      observed_at: "2026-03-02T00:00:00.000Z",
      raw_payload: { permit: "Wastewater expansion permit", seed: "industrial-tracker" },
    },
    {
      id: ids.evidence2,
      source_record_id: ids.source2,
      facility_id: ids.facilityDallas,
      company_id: ids.entityNorthCircuit,
      geo_id: ids.geoDallas,
      project_id: ids.project2,
      source_name: "USAspending.gov",
      dataset: "Federal award",
      evidence_type: "grant_awarded",
      source_url: "https://www.usaspending.gov",
      confidence_score: 96,
      observed_at: "2026-03-04T00:00:00.000Z",
      raw_payload: { award: "Domestic electronics capacity grant", seed: "industrial-tracker" },
    },
    {
      id: ids.evidence3,
      source_record_id: ids.source3,
      facility_id: ids.facilityChicago,
      company_id: ids.entityGreatLakes,
      geo_id: ids.geoCook,
      project_id: ids.project3,
      source_name: "SEC EDGAR",
      dataset: "Corporate filing",
      evidence_type: "capex_announced",
      source_url: "https://www.sec.gov/edgar",
      confidence_score: 82,
      observed_at: "2026-03-01T00:00:00.000Z",
      raw_payload: { filing: "Capex modernization disclosure", seed: "industrial-tracker" },
    },
  ]);

  await insert("derived_signals", [
    {
      id: ids.signal1,
      facility_id: ids.facilityHouston,
      company_id: ids.entityGulfChem,
      geo_id: ids.geoHarris,
      project_id: ids.project1,
      signal_type: "chemical_processing_detected",
      value: "ammonia-storage-expansion",
      evidence_id: ids.evidence1,
      observed_at: "2026-03-02T00:00:00.000Z",
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.signal2,
      facility_id: ids.facilityDallas,
      company_id: ids.entityNorthCircuit,
      geo_id: ids.geoDallas,
      project_id: ids.project2,
      signal_type: "federal_investment_signal",
      value: "1210000000",
      unit: "USD",
      evidence_id: ids.evidence2,
      observed_at: "2026-03-04T00:00:00.000Z",
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.signal3,
      facility_id: ids.facilityChicago,
      company_id: ids.entityGreatLakes,
      geo_id: ids.geoCook,
      project_id: ids.project3,
      signal_type: "new_construction_activity",
      value: "retrofit-modernization",
      evidence_id: ids.evidence3,
      observed_at: "2026-03-01T00:00:00.000Z",
      metadata: { seed: "industrial-tracker" },
    },
  ]);

  await insert("facility_events", [
    {
      id: ids.facilityEvent1,
      facility_id: ids.facilityHouston,
      event_type: "permit_filed",
      occurred_at: "2026-03-02T00:00:00.000Z",
      signal_id: ids.signal1,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.facilityEvent2,
      facility_id: ids.facilityDallas,
      event_type: "grant_awarded",
      occurred_at: "2026-03-04T00:00:00.000Z",
      signal_id: ids.signal2,
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.facilityEvent3,
      facility_id: ids.facilityChicago,
      event_type: "construction_started",
      occurred_at: "2026-03-01T00:00:00.000Z",
      signal_id: ids.signal3,
      metadata: { seed: "industrial-tracker" },
    },
  ]);

  await insert("model_hypotheses", [
    {
      id: ids.hypothesis1,
      facility_id: ids.facilityHouston,
      project_id: ids.project1,
      hypothesis_type: "probable_process_type",
      value: "petrochemical-processing",
      confidence_score: 78,
      evidence_ids: [ids.evidence1],
      model_version: "seed-v1",
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.hypothesis2,
      facility_id: ids.facilityDallas,
      project_id: ids.project2,
      hypothesis_type: "estimated_ot_assets",
      value: "high-automation-assembly-line",
      confidence_score: 74,
      evidence_ids: [ids.evidence2],
      model_version: "seed-v1",
      metadata: { seed: "industrial-tracker" },
    },
    {
      id: ids.hypothesis3,
      facility_id: ids.facilityChicago,
      project_id: ids.project3,
      hypothesis_type: "automation_level",
      value: "moderate-retrofit",
      confidence_score: 69,
      evidence_ids: [ids.evidence3],
      model_version: "seed-v1",
      metadata: { seed: "industrial-tracker" },
    },
  ]);
}

async function seed() {
  if (databaseUrl) {
    console.error(
      "DATABASE_URL-based seeding is no longer implemented here. Use Supabase server credentials for this project."
    );
    process.exit(1);
  }

  await seedViaSupabase();
  console.log("Seeded Industrial Tracker demo records via Supabase REST.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
