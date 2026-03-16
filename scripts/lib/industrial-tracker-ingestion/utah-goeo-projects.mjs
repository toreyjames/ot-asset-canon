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

const DEFAULT_UTAH_PROJECT_URLS = [
  "https://business.utah.gov/tax-credits/route-92-medical-relocates-headquarters-to-west-jordan-utah/",
  "https://business.utah.gov/tax-credits/schreiber-foods-expands-operations-in-cache-county/",
  "https://business.utah.gov/tax-credits/utah-based-mcm-engineering-ii-inc-expands-operations-in-iron-county/",
  "https://business.utah.gov/tax-credits/irrx-brings-expansion-to-the-railway-and-natural-resources-sectors-in-uintah-county/",
  "https://business.utah.gov/tax-credits/stryker-expands-in-utah-strengthening-the-states-life-sciences-sector/",
  "https://business.utah.gov/tax-credits/acs-manufacturing-strengthens-presence-in-davis-county/",
  "https://business.utah.gov/tax-credits/aerospace-leader-american-pacific-expands-in-iron-county/",
  "https://business.utah.gov/tax-credits/stadler-expansion-boosts-salt-lake-county/",
  "https://business.utah.gov/tax-credits/ppi-america-inc-grows-u-s-footprint-with-a-new-manufacturing-plant-in-iron-county/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "route-92-medical-relocates-headquarters-to-west-jordan-utah",
    {
      companyName: "Route 92 Medical",
      facilityName: "Route 92 Medical West Jordan Headquarters",
      city: "West Jordan",
      countyName: "Salt Lake County",
      amountUsd: 5_067_000,
      jobs: 116,
      techTags: ["medical_device", "life_sciences", "advanced_manufacturing"],
      sector: "life_sciences",
    },
  ],
  [
    "schreiber-foods-expands-operations-in-cache-county",
    {
      companyName: "Schreiber Foods",
      facilityName: "Schreiber Foods Logan Expansion",
      city: "Logan",
      countyName: "Cache County",
      amountUsd: 165_000_000,
      jobs: 145,
      techTags: ["food_processing", "cold_chain", "advanced_manufacturing"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "utah-based-mcm-engineering-ii-inc-expands-operations-in-iron-county",
    {
      companyName: "MCM Engineering II",
      facilityName: "MCM Engineering II Enoch Expansion",
      city: "Enoch",
      countyName: "Iron County",
      amountUsd: 168_000_000,
      jobs: 250,
      techTags: ["grid", "power_equipment", "advanced_manufacturing", "industrial_controls"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "irrx-brings-expansion-to-the-railway-and-natural-resources-sectors-in-uintah-county",
    {
      companyName: "Integrated Rail and Resources",
      facilityName: "IRRX Uintah County Rail and Resources Expansion",
      city: "Vernal",
      countyName: "Uintah County",
      amountUsd: 87_475_555,
      jobs: 40,
      techTags: ["rail", "logistics", "energy", "advanced_manufacturing"],
      sector: "infrastructure",
    },
  ],
  [
    "stryker-expands-in-utah-strengthening-the-states-life-sciences-sector",
    {
      companyName: "Stryker",
      facilityName: "Stryker Salt Lake County Expansion",
      city: "Salt Lake City",
      countyName: "Salt Lake County",
      amountUsd: 615_600_000,
      jobs: 862,
      techTags: ["medical_device", "life_sciences", "advanced_manufacturing"],
      sector: "life_sciences",
    },
  ],
  [
    "acs-manufacturing-strengthens-presence-in-davis-county",
    {
      companyName: "ACS Manufacturing",
      facilityName: "ACS Manufacturing Clearfield Expansion",
      city: "Clearfield",
      countyName: "Davis County",
      amountUsd: 31_500_000,
      jobs: 223,
      techTags: ["advanced_manufacturing", "power_equipment", "grid", "industrial_facility"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "aerospace-leader-american-pacific-expands-in-iron-county",
    {
      companyName: "American Pacific",
      facilityName: "American Pacific Iron County Aerospace Expansion",
      city: "Cedar City",
      countyName: "Iron County",
      amountUsd: 100_000_000,
      jobs: 26,
      techTags: ["aerospace", "defense", "advanced_manufacturing", "energetics"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "stadler-expansion-boosts-salt-lake-county",
    {
      companyName: "Stadler",
      facilityName: "Stadler Salt Lake County Rail Expansion",
      city: "Salt Lake City",
      countyName: "Salt Lake County",
      amountUsd: 189_450_000,
      jobs: 65,
      techTags: ["rail", "mobility", "advanced_manufacturing"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "ppi-america-inc-grows-u-s-footprint-with-a-new-manufacturing-plant-in-iron-county",
    {
      companyName: "PPI America",
      facilityName: "PPI America Cedar City Manufacturing Plant",
      city: "Cedar City",
      countyName: "Iron County",
      amountUsd: 52_200_000,
      jobs: 50,
      techTags: ["industrial_materials", "advanced_manufacturing", "building_products"],
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
  if (haystack.includes("medical")) tags.add("life_sciences");
  if (haystack.includes("rail")) tags.add("rail");
  if (haystack.includes("aerospace")) tags.add("aerospace");
  if (haystack.includes("facility")) tags.add("industrial_facility");
  return Array.from(tags);
}

async function loadUtahCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.UT&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`UT:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchUtahProjectPage(url) {
  const userAgent =
    process.env.UTAH_PROJECTS_USER_AGENT ||
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
      throw new Error(`Utah project fetch failed: ${response.status} ${url}`);
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
      "Utah strategic project",
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

export async function ingestUtahGoeoProjects() {
  const urls = readListEnv("UTAH_PROJECT_URLS", DEFAULT_UTAH_PROJECT_URLS);
  const countyMap = await loadUtahCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchUtahProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Utah Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`UT:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "UT",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:utah-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:utah-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:utah-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:utah-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:utah-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:utah-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:utah-projects:${sourceNaturalId}`);
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
      confidence_score: 87,
      metadata: {
        source: sourceName,
        state: "UT",
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: override.facilityName,
      normalized_name: normalizeName(override.facilityName),
      address: {
        city: override.city,
        state: "UT",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 88 : 76,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: override.city ? `${override.city}, UT` : `${override.countyName}, UT`,
        tech_tags: techTags,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: sourceNaturalId,
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
      extraction_version: "utah-goeo-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "state_strategic_project",
      sector: override.sector || techTags[0] || "industrial",
      status: "active",
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
      provider_name: "Utah Governor's Office of Economic Opportunity",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "UT",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: override.city ? `${override.city}, UT` : `${override.countyName}, UT`,
      },
      recipient_location: {
        city: override.city,
        state: "UT",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "Utah Strategic Projects",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "utah_goeo_override",
        matchedFacilityStrategy: geoId ? "utah_county_match" : "utah_state_or_city_only",
        notes: ["Official Utah GOEO strategic project announcement parsed from article HTML."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "utah_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 86,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        amount: override.amountUsd,
        jobs: override.jobs,
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
        state: "UT",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:utah-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: override.city ? `${override.city}, UT` : `${override.countyName}, UT`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:utah-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8800" : "0.7600",
      rationale: "Resolved from official Utah GOEO strategic project announcement.",
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
    });

    bundle.programLinkRows.push({
      id: deterministicUuid(`program-link:utah-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      program_type: "state_incentive",
      external_program_id: sourceNaturalId,
      agency: "Utah Governor's Office of Economic Opportunity",
      metadata: {
        source_url: page.url,
        sector: override.sector || "advanced_manufacturing",
      },
    });
  }

  return bundle;
}
