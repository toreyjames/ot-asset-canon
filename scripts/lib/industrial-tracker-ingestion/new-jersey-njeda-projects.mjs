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

const DEFAULT_NEW_JERSEY_PROJECT_URLS = [
  "https://www.njeda.gov/governor-murphy-princeton-university-microsoft-coreweave-cut-ribbon-on-major-artificial-intelligence-hub/",
  "https://www.njeda.gov/njeda-and-coreweave-announce-creation-of-20m-ai-hub-fund-to-support-innovative-startups/",
  "https://www.njeda.gov/helix-phase-2-approved-for-aspire-tax-credits-by-njeda-board/",
  "https://www.njeda.gov/governor-murphy-announces-planned-aerospace-innovation-center-in-atlantic-county/",
  "https://www.njeda.gov/murphy-administration-announces-new-genmab-location-expanding-states-presence-in-biotech-field/",
  "https://www.njeda.gov/governor-murphy-cuts-the-ribbon-at-hax-flagship-u-s-hq-in-newark/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "governor-murphy-princeton-university-microsoft-coreweave-cut-ribbon-on-major-artificial-intelligence-hub",
    {
      companyName: "NJ AI Hub",
      facilityName: "NJ AI Hub",
      city: "West Windsor Township",
      countyName: "Mercer County",
      amountUsd: 72_000_000,
      jobs: null,
      techTags: ["ai", "advanced_computing", "data_center", "innovation_center"],
    },
  ],
  [
    "njeda-and-coreweave-announce-creation-of-20m-ai-hub-fund-to-support-innovative-startups",
    {
      companyName: "NJ AI Hub Fund",
      facilityName: "NJ AI Hub Venture Fund",
      city: "Trenton",
      countyName: "Mercer County",
      amountUsd: 20_000_000,
      jobs: null,
      techTags: ["ai", "venture_capital", "innovation_center"],
    },
  ],
  [
    "helix-phase-2-approved-for-aspire-tax-credits-by-njeda-board",
    {
      companyName: "Nokia Bell Labs",
      facilityName: "HELIX H-2 Innovation Hub",
      city: "New Brunswick",
      countyName: "Middlesex County",
      amountUsd: 103_900_000,
      jobs: null,
      techTags: ["life_sciences", "ai", "cloud", "advanced_computing", "innovation_center"],
    },
  ],
  [
    "governor-murphy-announces-planned-aerospace-innovation-center-in-atlantic-county",
    {
      companyName: "Aerospace Innovation Center",
      facilityName: "Aerospace Innovation Center",
      city: "Egg Harbor Township",
      countyName: "Atlantic County",
      amountUsd: 18_500_000,
      jobs: null,
      techTags: ["aerospace_defense", "innovation_center", "advanced_manufacturing"],
    },
  ],
  [
    "murphy-administration-announces-new-genmab-location-expanding-states-presence-in-biotech-field",
    {
      companyName: "Genmab US, Inc.",
      facilityName: "Genmab Plainsboro Expansion",
      city: "Plainsboro",
      countyName: "Middlesex County",
      amountUsd: 32_600_000,
      jobs: 300,
      techTags: ["life_sciences", "biotech", "pharmaceuticals"],
    },
  ],
  [
    "governor-murphy-cuts-the-ribbon-at-hax-flagship-u-s-hq-in-newark",
    {
      companyName: "HAX, LLC",
      facilityName: "HAX Newark Headquarters",
      city: "Newark",
      countyName: "Essex County",
      amountUsd: 50_000_000,
      jobs: 2500,
      techTags: ["advanced_manufacturing", "industrial_automation", "climate_tech", "innovation_center"],
    },
  ],
]);

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&#x2019;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
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
  if (haystack.includes("ai")) tags.add("ai");
  if (haystack.includes("aerospace")) tags.add("aerospace_defense");
  if (haystack.includes("biotech") || haystack.includes("life science")) tags.add("life_sciences");
  if (haystack.includes("innovation center") || haystack.includes("hub")) tags.add("innovation_center");
  return Array.from(tags);
}

async function loadNewJerseyCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.NJ&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`NJ:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchNewJerseyProject(url) {
  const userAgent =
    process.env.NEW_JERSEY_PROJECTS_USER_AGENT ||
    process.env.SEC_USER_AGENT ||
    "Baseload Industrial Tracker contact@aibaseload.com";
  const slug = slugFromUrl(url);
  const apiUrl = `https://www.njeda.gov/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`;

  let body;
  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json,text/html",
      },
    });
    if (!response.ok) {
      throw new Error(`New Jersey project fetch failed: ${response.status} ${url}`);
    }
    body = await response.text();
  } catch (error) {
    const { stdout } = await execFileAsync("curl", [
      "-sL",
      "-A",
      userAgent,
      "-H",
      "Accept: application/json,text/html",
      apiUrl,
    ]);
    if (!stdout?.trim()) throw error;
    body = stdout;
  }

  const records = JSON.parse(body);
  const record = Array.isArray(records) ? records[0] : null;
  if (!record) {
    throw new Error(`New Jersey project fetch returned no record: ${url}`);
  }

  return {
    url,
    slug,
    title: stripHtml(record.title?.rendered || "New Jersey strategic project"),
    publishedAt: record.date || null,
    description: stripHtml(record.excerpt?.rendered || ""),
    text: stripHtml(record.content?.rendered || ""),
    raw: record,
  };
}

export async function ingestNewJerseyNjedaProjects() {
  const urls = readListEnv("NEW_JERSEY_PROJECT_URLS", DEFAULT_NEW_JERSEY_PROJECT_URLS);
  const countyMap = await loadNewJerseyCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchNewJerseyProject(url)));
  const bundle = emptyBundle();
  const sourceName = "New Jersey Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`NJ:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "NJ",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:new-jersey-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:new-jersey-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:new-jersey-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:new-jersey-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:new-jersey-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:new-jersey-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:new-jersey-projects:${sourceNaturalId}`);
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
        state: "NJ",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 88 : 77,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: `${override.city}, NJ`,
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
        location: {
          city: override.city,
          countyName: override.countyName,
          label: `${override.city}, NJ`,
        },
      },
      extraction_version: "new-jersey-njeda-projects-v1",
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
      provider_name: "New Jersey Economic Development Authority",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "NJ",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: `${override.city}, NJ`,
      },
      recipient_location: {
        city: override.city,
        state: "NJ",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "NJEDA Strategic Projects",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "new_jersey_njeda_override",
        matchedFacilityStrategy: geoId ? "new_jersey_county_match" : "new_jersey_state_or_city_only",
        notes: ["Official NJEDA strategic project announcement parsed from WP JSON endpoint."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "new_jersey_state_projects",
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
        state: "NJ",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:new-jersey-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: `${override.city}, NJ`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:new-jersey-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official NJEDA WordPress JSON project announcement.",
    });
  }

  return bundle;
}
