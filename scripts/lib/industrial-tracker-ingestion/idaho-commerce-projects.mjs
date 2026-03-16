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

const DEFAULT_IDAHO_PROJECT_URLS = [
  "https://commerce.idaho.gov/blog/the-stow-company-chooses-nampa-for-its-new-facility/",
  "https://commerce.idaho.gov/blog/dot-foods-announces-22-million-expansion-in-burley/",
  "https://commerce.idaho.gov/blog/micron-announces-15-billion-investment-in-boise/",
  "https://commerce.idaho.gov/blog/timberline-helicopters-builds-upon-legacy-in-sandpoint/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "the-stow-company-chooses-nampa-for-its-new-facility",
    {
      companyName: "The Stow Company",
      facilityName: "The Stow Company Nampa Manufacturing Facility",
      city: "Nampa",
      countyName: "Canyon County",
      amountUsd: 140_000_000,
      jobs: 236,
      techTags: ["advanced_manufacturing", "building_products", "consumer_manufacturing"],
      sector: "advanced_manufacturing",
    },
  ],
  [
    "dot-foods-announces-22-million-expansion-in-burley",
    {
      companyName: "Dot Foods",
      facilityName: "Dot Foods Burley Distribution Expansion",
      city: "Burley",
      countyName: "Cassia County",
      amountUsd: 22_000_000,
      jobs: 80,
      techTags: ["logistics", "cold_chain", "food_processing", "distribution"],
      sector: "logistics",
    },
  ],
  [
    "micron-announces-15-billion-investment-in-boise",
    {
      companyName: "Micron Technology",
      facilityName: "Micron Boise Leading-Edge Memory Fab",
      city: "Boise",
      countyName: "Ada County",
      amountUsd: 15_000_000_000,
      jobs: 2000,
      techTags: ["semiconductor", "advanced_manufacturing", "ai", "memory"],
      sector: "semiconductors",
    },
  ],
  [
    "timberline-helicopters-builds-upon-legacy-in-sandpoint",
    {
      companyName: "Timberline Helicopters",
      facilityName: "Timberline Helicopters Sandpoint Hangar Expansion",
      city: "Sandpoint",
      countyName: "Bonner County",
      amountUsd: 13_000_000,
      jobs: 24,
      techTags: ["aerospace", "defense", "aviation", "advanced_manufacturing"],
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
  if (haystack.includes("semiconductor")) tags.add("semiconductor");
  if (haystack.includes("distribution")) tags.add("logistics");
  if (haystack.includes("hangar")) tags.add("aviation");
  return Array.from(tags);
}

async function loadIdahoCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.ID&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`ID:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchIdahoProjectPage(url) {
  const userAgent =
    process.env.IDAHO_PROJECTS_USER_AGENT ||
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
      throw new Error(`Idaho project fetch failed: ${response.status} ${url}`);
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
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1]?.trim() ||
      "Idaho strategic project",
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

export async function ingestIdahoCommerceProjects() {
  const urls = readListEnv("IDAHO_PROJECT_URLS", DEFAULT_IDAHO_PROJECT_URLS);
  const countyMap = await loadIdahoCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchIdahoProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Idaho Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`ID:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "ID",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:idaho-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:idaho-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:idaho-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:idaho-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:idaho-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:idaho-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:idaho-projects:${sourceNaturalId}`);
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
        state: "ID",
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
        state: "ID",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 88 : 76,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: override.city ? `${override.city}, ID` : `${override.countyName}, ID`,
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
      extraction_version: "idaho-commerce-projects-v1",
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
      provider_name: "Idaho Commerce",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "ID",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: override.city ? `${override.city}, ID` : `${override.countyName}, ID`,
      },
      recipient_location: {
        city: override.city,
        state: "ID",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: sourceName,
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "idaho_commerce_override",
        matchedFacilityStrategy: geoId ? "idaho_county_match" : "idaho_state_or_city_only",
        notes: ["Official Idaho Commerce strategic project announcement parsed from article HTML."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "idaho_state_projects",
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
        state: "ID",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:idaho-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: override.city ? `${override.city}, ID` : `${override.countyName}, ID`,
      },
    });

    bundle.programLinkRows.push({
      id: deterministicUuid(`program-link:idaho-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      program_type: "state_incentive",
      external_program_id: sourceNaturalId,
      agency: "Idaho Commerce",
      metadata: {
        source_url: page.url,
        sector: override.sector || "advanced_manufacturing",
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:idaho-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official Idaho Commerce strategic project announcement.",
    });
  }

  return bundle;
}
