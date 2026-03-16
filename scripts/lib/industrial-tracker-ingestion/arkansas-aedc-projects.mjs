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
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_ARKANSAS_PROJECT_URLS = [
  "https://www.arkansasedc.com/news-events/newsroom/detail/2026/03/06/conagra-brands-to-expand-manufacturing-operations-in-fayetteville--arkansas",
  "https://www.arkansasedc.com/news-events/newsroom/detail/2026/03/05/clayton-home-building-group-celebrates-grand-opening-of-new-home-building-facility-in-conway--arkansas",
  "https://www.arkansasedc.com/news-events/newsroom/detail/2026/02/27/faymonville-group-celebrates-steel-topping-out-at-new-facility-in-little-rock--arkansas",
  "https://www.arkansasedc.com/news-events/newsroom/detail/2026/02/25/sediver-usa-grows-in-west-memphis--arkansas--plans-to-create-40-new-jobs",
  "https://www.arkansasedc.com/news-events/newsroom/detail/2026/02/13/bell-lumber---pole-expands-manufacturing-facility-in-de-queen--arkansas",
  "https://www.arkansasedc.com/news-events/newsroom/detail/2026/02/03/innovasian-to-build-175-000-square-foot-food-manufacturing-facility-in-jonesboro--arkansas",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "conagra-brands-to-expand-manufacturing-operations-in-fayetteville--arkansas",
    {
      companyName: "Conagra Brands",
      facilityName: "Conagra Brands Fayetteville Manufacturing Expansion",
      city: "Fayetteville",
      countyName: "Washington County",
      amountUsd: 220_000_000,
      jobs: 60,
      techTags: ["food_processing", "advanced_manufacturing", "consumer_manufacturing"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "clayton-home-building-group-celebrates-grand-opening-of-new-home-building-facility-in-conway--arkansas",
    {
      companyName: "Clayton Home Building Group",
      facilityName: "Clayton Home Building Group Conway Facility",
      city: "Conway",
      countyName: "Faulkner County",
      amountUsd: 35_000_000,
      jobs: 250,
      techTags: ["building_products", "advanced_manufacturing", "housing"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "faymonville-group-celebrates-steel-topping-out-at-new-facility-in-little-rock--arkansas",
    {
      companyName: "Faymonville Group",
      facilityName: "Faymonville Group Little Rock Manufacturing Facility",
      city: "Little Rock",
      countyName: "Pulaski County",
      amountUsd: 100_000_000,
      jobs: 500,
      techTags: ["mobility", "heavy_equipment", "advanced_manufacturing", "steel"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "sediver-usa-grows-in-west-memphis--arkansas--plans-to-create-40-new-jobs",
    {
      companyName: "Sediver USA",
      facilityName: "Sediver USA West Memphis Grid Glass Expansion",
      city: "West Memphis",
      countyName: "Crittenden County",
      amountUsd: 18_000_000,
      jobs: 40,
      techTags: ["grid", "power_equipment", "glass", "advanced_manufacturing"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "bell-lumber---pole-expands-manufacturing-facility-in-de-queen--arkansas",
    {
      companyName: "Bell Lumber & Pole",
      facilityName: "Bell Lumber & Pole De Queen Manufacturing Facility",
      city: "De Queen",
      countyName: "Sevier County",
      amountUsd: 12_000_000,
      jobs: 12,
      techTags: ["wood_products", "grid", "industrial_materials", "advanced_manufacturing"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "innovasian-to-build-175-000-square-foot-food-manufacturing-facility-in-jonesboro--arkansas",
    {
      companyName: "InnovAsian",
      facilityName: "InnovAsian Jonesboro Frozen Food Facility",
      city: "Jonesboro",
      countyName: "Craighead County",
      amountUsd: 43_000_000,
      jobs: 200,
      techTags: ["food_processing", "cold_chain", "advanced_manufacturing"],
      sector: "advanced_manufacturing",
    },
  ],
]);

function stripHtml(html) {
  return String(html || "")
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

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("food")) tags.add("food_processing");
  if (haystack.includes("facility")) tags.add("industrial_facility");
  if (haystack.includes("grid")) tags.add("grid");
  return Array.from(tags);
}

async function loadArkansasCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.AR&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`AR:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchArkansasProjectPage(url) {
  const userAgent =
    process.env.ARKANSAS_PROJECTS_USER_AGENT ||
    process.env.SEC_USER_AGENT ||
    "Baseload Industrial Tracker contact@aibaseload.com";

  let html;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      throw new Error(`Arkansas project fetch failed: ${response.status} ${url}`);
    }
    html = await response.text();
  } catch (error) {
    const { stdout } = await execFileAsync("curl", [
      "-sL",
      "-A",
      userAgent,
      "-H",
      "Accept: text/html,application/xhtml+xml",
      url,
    ]);
    if (!stdout?.trim()) throw error;
    html = stdout;
  }

  return {
    url,
    slug: slugFromUrl(url),
    html,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1]?.trim() ||
      "Arkansas strategic project",
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

export async function ingestArkansasAedcProjects() {
  const urls = readListEnv("ARKANSAS_PROJECT_URLS", DEFAULT_ARKANSAS_PROJECT_URLS);
  const countyMap = await loadArkansasCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchArkansasProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Arkansas Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`AR:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "AR",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:arkansas-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:arkansas-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:arkansas-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:arkansas-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:arkansas-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:arkansas-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:arkansas-projects:${sourceNaturalId}`);
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
      facility_name: override.facilityName,
      normalized_name: normalizeName(override.facilityName),
      address: {
        city: override.city,
        state: "AR",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 88 : 76,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: `${override.city}, AR`,
        tech_tags: techTags,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: page.url,
      source_category: "incentive",
      source_url: page.url,
      source_hash: sha256(JSON.stringify({ page, override })),
      fetched_at: new Date().toISOString(),
      effective_date: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        companyName: override.companyName,
        amount: override.amountUsd,
        jobs: override.jobs || null,
        location: {
          city: override.city,
          countyName: override.countyName,
        },
      },
      extraction_version: "arkansas-aedc-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "state_strategic_project",
      sector: override.sector || techTags[0] || "industrial",
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
      provider_name: "Arkansas Economic Development Commission",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "AR",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: `${override.city}, AR`,
      },
      recipient_location: {
        city: override.city,
        state: "AR",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "Arkansas Strategic Projects",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "arkansas_aedc_override",
        matchedFacilityStrategy: geoId ? "arkansas_county_match" : "arkansas_state_or_city_only",
        notes: ["Official Arkansas AEDC newsroom project announcement parsed from article HTML."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "arkansas_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 86,
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
        state: "AR",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:arkansas-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: `${override.city}, AR`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:arkansas-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8800" : "0.7600",
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
      rationale: "Resolved from official Arkansas AEDC strategic project announcement.",
    });
  }

  return bundle;
}
