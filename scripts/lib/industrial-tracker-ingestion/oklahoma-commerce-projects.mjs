import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  readListEnv,
  sha256,
  supabaseFetch,
  techTagsFromText,
} from "./common.mjs";

const DEFAULT_OKLAHOMA_PROJECT_URLS = [
  "https://www.okcommerce.gov/century-aluminum-joins-ega-project-to-build-first-u-s-smelter-in-almost-50-years/",
  "https://www.okcommerce.gov/cbc-global-ammunition-selects-oklahoma-for-300-million-investment/",
  "https://www.okcommerce.gov/firehawk-aerospace-gov-stitt-announce-22-million-investment-in-lawton/",
  "https://www.okcommerce.gov/stardust-power-completes-front-end-loading-3-report-fel-3-for-its-oklahoma-lithium-refinery/",
  "https://www.okcommerce.gov/sofidel-groups-inola-manufacturing-facility/",
  "https://www.okcommerce.gov/the-pump-motor-works-awarded-400000-through-business-expansion-incentive-program/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "century-aluminum-joins-ega-project-to-build-first-u-s-smelter-in-almost-50-years",
    {
      companyName: "Oklahoma Primary Aluminum",
      city: "Inola",
      countyName: "Rogers County",
      amountUsd: 4_000_000_000,
      jobs: 1000,
      techTags: ["metals", "critical_minerals", "advanced_manufacturing"],
      facilityName: "Oklahoma Primary Aluminum Smelter",
    },
  ],
  [
    "cbc-global-ammunition-selects-oklahoma-for-300-million-investment",
    {
      companyName: "CBC Global Ammunition",
      city: "Pryor",
      countyName: "Mayes County",
      amountUsd: 300_000_000,
      jobs: 350,
      techTags: ["defense", "advanced_manufacturing", "energetics"],
      facilityName: "CBC MidAmerica Ammunition Facility",
    },
  ],
  [
    "firehawk-aerospace-gov-stitt-announce-22-million-investment-in-lawton",
    {
      companyName: "Firehawk Aerospace",
      city: "Lawton",
      countyName: "Comanche County",
      amountUsd: 22_000_000,
      techTags: ["defense", "advanced_manufacturing", "rocket_propulsion"],
      facilityName: "Firehawk Lawton Propulsion Facility",
    },
  ],
  [
    "stardust-power-completes-front-end-loading-3-report-fel-3-for-its-oklahoma-lithium-refinery",
    {
      companyName: "Stardust Power",
      city: "Muskogee",
      countyName: "Muskogee County",
      amountUsd: 500_000_000,
      techTags: ["battery", "critical_minerals", "advanced_manufacturing"],
      facilityName: "Stardust Muskogee Lithium Refinery",
    },
  ],
  [
    "sofidel-groups-inola-manufacturing-facility",
    {
      companyName: "Sofidel Group",
      city: "Inola",
      countyName: "Rogers County",
      amountUsd: 360_000_000,
      jobs: 350,
      techTags: ["consumer_manufacturing", "paper", "advanced_manufacturing"],
      facilityName: "Sofidel Inola Tissue Manufacturing Facility",
    },
  ],
  [
    "the-pump-motor-works-awarded-400000-through-business-expansion-incentive-program",
    {
      companyName: "The Pump & Motor Works",
      city: "Okmulgee",
      countyName: "Okmulgee County",
      amountUsd: 2_400_000,
      jobs: 15,
      techTags: ["industrial_equipment", "power_equipment", "advanced_manufacturing"],
      facilityName: "Pump & Motor Works Expansion",
    },
  ],
]);

function normalizeCountyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(county|parish|borough|city)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromUrl(url) {
  return String(url).split("/").filter(Boolean).pop() || url;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&#x2019;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("lithium")) tags.add("battery");
  if (haystack.includes("smelter") || haystack.includes("aluminum")) tags.add("metals");
  if (haystack.includes("ammunition") || haystack.includes("defense")) tags.add("defense");
  if (haystack.includes("manufacturing")) tags.add("advanced_manufacturing");
  if (haystack.includes("motor") || haystack.includes("pump")) tags.add("industrial_equipment");
  return Array.from(tags);
}

async function loadOklahomaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.OK&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`OK:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchOklahomaProject(url) {
  const userAgent =
    process.env.OKLAHOMA_PROJECTS_USER_AGENT ||
    process.env.SEC_USER_AGENT ||
    "Baseload Industrial Tracker contact@aibaseload.com";
  const slug = slugFromUrl(url);
  const apiUrl = `https://www.okcommerce.gov/wp-json/wp/v2/posts?slug=${encodeURIComponent(
    slug
  )}&_fields=title,date,excerpt,content`;

  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json,text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`Oklahoma project fetch failed: ${response.status} ${url}`);
  }

  const records = await response.json();
  const record = Array.isArray(records) ? records[0] : null;
  if (!record) {
    throw new Error(`Oklahoma project fetch returned no record: ${url}`);
  }

  return {
    url,
    slug,
    title: stripHtml(record.title?.rendered || "Oklahoma strategic project"),
    publishedAt: record.date || null,
    description: stripHtml(record.excerpt?.rendered || ""),
    text: stripHtml(record.content?.rendered || ""),
    raw: record,
  };
}

export async function ingestOklahomaCommerceProjects() {
  const urls = readListEnv("OKLAHOMA_PROJECT_URLS", DEFAULT_OKLAHOMA_PROJECT_URLS);
  const countyMap = await loadOklahomaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchOklahomaProject(url)));
  const bundle = emptyBundle();
  const sourceName = "Oklahoma Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`OK:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "OK",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:oklahoma-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:oklahoma-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:oklahoma-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:oklahoma-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:oklahoma-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:oklahoma-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:oklahoma-projects:${sourceNaturalId}`);
    const techTags = buildTechTags(page.title, page.description, page.text, override);
    const facilityName = override.facilityName || page.title;

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: override.companyName,
      normalized_name: normalizeName(override.companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 87,
      metadata: { source: sourceName },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: facilityName,
      normalized_name: normalizeName(facilityName),
      address: {
        city: override.city,
        state: "OK",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 88 : 77,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: `${override.city}, OK`,
        tech_tags: techTags,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: page.url,
      source_category: "incentive",
      source_url: page.url,
      source_hash: sha256(JSON.stringify(page.raw)),
      fetched_at: new Date().toISOString(),
      effective_date: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        companyName: override.companyName,
        amount: override.amountUsd,
        jobs: override.jobs || null,
        city: override.city,
        countyName: override.countyName,
      },
      extraction_version: "oklahoma-commerce-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "state_strategic_project",
      sector: techTags[0] || "industrial",
      status: "announced",
      investment_amount: override.amountUsd,
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      metadata: {
        source: sourceName,
        jobs_estimate: override.jobs || null,
        source_url: page.url,
        description: page.description,
      },
    });

    bundle.investmentRows.push({
      id: eventId,
      source_record_id: sourceRecordId,
      geo_id: geoId,
      taxonomy_id: null,
      event_type: "strategic_capital_commitment",
      amount: String(override.amountUsd),
      amount_type: "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_entity_id: null,
      recipient_entity_id: companyId,
      facility_id: facilityId,
      provider_name: "Oklahoma Department of Commerce",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "OK",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: `${override.city}, OK`,
      },
      recipient_location: {
        city: override.city,
        state: "OK",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "Oklahoma Department of Commerce",
      confidence_score: geoId ? 88 : 77,
      provenance: {
        matchedEntityStrategy: "oklahoma_commerce_override",
        matchedFacilityStrategy: geoId ? "oklahoma_county_match" : "oklahoma_state_or_city_only",
        notes: ["Official Oklahoma Department of Commerce strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      source_name: sourceName,
      dataset: "oklahoma_state_projects",
      evidence_type: "state_incentive_announced",
      source_url: page.url,
      observed_at: observedAt,
      raw_payload: {
        title: page.title,
        amount: override.amountUsd,
        jobs: override.jobs || null,
      },
      confidence_score: 87,
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      evidence_id: evidenceId,
      signal_type: "state_strategic_project",
      value: String(override.amountUsd),
      unit: "USD",
      observed_at: observedAt,
      metadata: {
        jobs: override.jobs || null,
        tech_tags: techTags,
        state: "OK",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:oklahoma-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: `${override.city}, OK`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:oklahoma-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8800" : "0.7700",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        sectorAlignment: true,
        companyName: override.companyName,
        location: {
          city: override.city,
          countyName: override.countyName,
        },
        techTags,
      },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official Oklahoma Department of Commerce strategic project announcement.",
    });
  }

  return bundle;
}
