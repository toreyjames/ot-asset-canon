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

const DEFAULT_KANSAS_PROJECT_URLS = [
  "https://www.kansascommerce.gov/2025/07/governor-kelly-celebrates-grand-opening-of-panasonic-ev-battery-manufacturing-facility-in-de-soto/",
  "https://www.kansascommerce.gov/2025/06/governor-kelly-announces-grand-opening-of-heartland-coca-cola-olathe-production-campus/",
  "https://www.kansascommerce.gov/2025/05/merck-animal-health-investing-895m-in-de-soto-plant-expansion/",
  "https://www.kansascommerce.gov/2024/12/governor-kelly-announces-flora-food-group-investing-90m-creating-100-new-jobs-in-hugoton/",
  "https://www.kansascommerce.gov/2024/08/governor-kelly-announces-marshalltown-to-invest-27m-create-40-jobs-in-wyandotte-county/",
  "https://www.kansascommerce.gov/2024/08/governor-kelly-elanco-to-invest-130-million-create-70-jobs-in-elwood/",
  "https://www.kansascommerce.gov/2024/07/governor-kelly-announces-summit-truck-bodies-investing-50m-creating-80-new-jobs-in-wathena/",
  "https://www.kansascommerce.gov/2024/03/marvin-investing-76-5m-creating-600-jobs-in-kansas-city-kansas/",
  "https://www.kansascommerce.gov/2024/03/governor-kelly-announces-ht-recharge-investing-110m-creating-180-jobs-as-new-panasonic-supplier/",
  "https://www.kansascommerce.gov/2022/07/kansas-lands-4b-4000-job-panasonic-energy-electric-vehicle-battery-plant/",
];

const ARTICLE_OVERRIDES = new Map([
  ["governor-kelly-celebrates-grand-opening-of-panasonic-ev-battery-manufacturing-facility-in-de-soto", { companyName: "Panasonic Energy", city: "De Soto", countyName: "Johnson County", amountUsd: 4_000_000_000, jobs: 4000, techTags: ["battery", "ev", "advanced_manufacturing"] }],
  ["governor-kelly-announces-grand-opening-of-heartland-coca-cola-olathe-production-campus", { companyName: "Heartland Coca-Cola", city: "Olathe", countyName: "Johnson County", amountUsd: 400_000_000, techTags: ["food_processing", "advanced_manufacturing"] }],
  ["merck-animal-health-investing-895m-in-de-soto-plant-expansion", { companyName: "Merck Animal Health", city: "De Soto", countyName: "Johnson County", amountUsd: 895_000_000, techTags: ["life_sciences", "biomanufacturing", "advanced_manufacturing"] }],
  ["governor-kelly-announces-flora-food-group-investing-90m-creating-100-new-jobs-in-hugoton", { companyName: "Flora Food Group", city: "Hugoton", countyName: "Stevens County", amountUsd: 90_000_000, jobs: 100, techTags: ["food_processing", "advanced_manufacturing"] }],
  ["governor-kelly-announces-marshalltown-to-invest-27m-create-40-jobs-in-wyandotte-county", { companyName: "MARSHALLTOWN", city: "Kansas City", countyName: "Wyandotte County", amountUsd: 27_000_000, jobs: 40, techTags: ["industrial_tools", "advanced_manufacturing"] }],
  ["governor-kelly-elanco-to-invest-130-million-create-70-jobs-in-elwood", { companyName: "Elanco Animal Health", city: "Elwood", countyName: "Doniphan County", amountUsd: 130_000_000, jobs: 70, techTags: ["life_sciences", "biomanufacturing", "advanced_manufacturing"] }],
  ["governor-kelly-announces-summit-truck-bodies-investing-50m-creating-80-new-jobs-in-wathena", { companyName: "Summit Truck Bodies", city: "Wathena", countyName: "Doniphan County", amountUsd: 50_000_000, jobs: 80, techTags: ["mobility", "advanced_manufacturing"] }],
  ["marvin-investing-76-5m-creating-600-jobs-in-kansas-city-kansas", { companyName: "Marvin", city: "Kansas City", countyName: "Wyandotte County", amountUsd: 76_500_000, jobs: 600, techTags: ["building_products", "advanced_manufacturing"] }],
  ["governor-kelly-announces-ht-recharge-investing-110m-creating-180-jobs-as-new-panasonic-supplier", { companyName: "H&T Recharge", city: "De Soto", countyName: "Johnson County", amountUsd: 110_000_000, jobs: 180, techTags: ["battery", "advanced_manufacturing", "electronics"] }],
  ["kansas-lands-4b-4000-job-panasonic-energy-electric-vehicle-battery-plant", { companyName: "Panasonic Energy", city: "De Soto", countyName: "Johnson County", amountUsd: 4_000_000_000, jobs: 4000, techTags: ["battery", "ev", "advanced_manufacturing"] }],
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

function extractMetaContent(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("battery")) tags.add("battery");
  if (haystack.includes("ev")) tags.add("ev");
  if (haystack.includes("animal health")) tags.add("life_sciences");
  if (haystack.includes("manufacturing")) tags.add("advanced_manufacturing");
  return Array.from(tags);
}

async function loadKansasCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.KS&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`KS:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchKansasProjectPage(url) {
  const userAgent =
    process.env.KANSAS_PROJECTS_USER_AGENT ||
    process.env.SEC_USER_AGENT ||
    "Baseload Industrial Tracker contact@aibaseload.com";

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Kansas project fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();

  return {
    url,
    slug: slugFromUrl(url),
    html,
    title:
      extractMetaContent(html, "og:title") ||
      html.match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1]?.trim() ||
      "Kansas strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestKansasCommerceProjects() {
  const urls = readListEnv("KANSAS_PROJECT_URLS", DEFAULT_KANSAS_PROJECT_URLS);
  const countyMap = await loadKansasCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchKansasProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Kansas Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo =
      countyMap.get(`KS:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "KS",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:kansas-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:kansas-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:kansas-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:kansas-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:kansas-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:kansas-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:kansas-projects:${sourceNaturalId}`);
    const techTags = buildTechTags(page.title, page.description, page.text, override);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: override.companyName,
      normalized_name: normalizeName(override.companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 86,
      metadata: { source: sourceName },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: page.title.replace(/\s+-\s+Kansas Department of Commerce$/i, "").trim(),
      normalized_name: normalizeName(
        page.title.replace(/\s+-\s+Kansas Department of Commerce$/i, "")
      ),
      address: {
        city: override.city,
        state: "KS",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 87 : 76,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: `${override.city}, KS`,
        tech_tags: techTags,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: page.url,
      source_category: "incentive",
      source_url: page.url,
      source_hash: sha256(page.html),
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
      extraction_version: "kansas-commerce-projects-v1",
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
      provider_name: "Kansas Department of Commerce",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "KS",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: `${override.city}, KS`,
      },
      recipient_location: {
        city: override.city,
        state: "KS",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "Kansas Department of Commerce",
      confidence_score: geoId ? 87 : 77,
      provenance: {
        matchedEntityStrategy: "kansas_commerce_override",
        matchedFacilityStrategy: geoId ? "kansas_county_match" : "kansas_state_or_city_only",
        notes: ["Official Kansas Department of Commerce strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "kansas_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 87,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        amount: override.amountUsd,
        jobs: override.jobs || null,
      },
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "state_incentive_recorded",
      value: String(override.amountUsd),
      unit: "USD",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        jobs: override.jobs || null,
        tech_tags: techTags,
        state: "KS",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:kansas-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: `${override.city}, KS`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:kansas-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8700" : "0.7700",
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
      rationale: "Resolved from official Kansas Department of Commerce strategic project announcement.",
    });
  }

  return bundle;
}
