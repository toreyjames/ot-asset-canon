import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  readListEnv,
  sha256,
  supabaseFetch,
} from "./common.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_MISSISSIPPI_PROJECT_URLS = [
  "https://mississippi.org/news/southwark-metal-manufacturing-company-expanding-operations-in-desoto-county/",
  "https://mississippi.org/news/defense-technology-leader-general-atomics-expanding-operations-in-shannon/",
  "https://mississippi.org/news/carpenter-pole-and-piling-expanding-in-stone-county/",
  "https://mississippi.org/news/firehawk-aerospace-to-manufacture-rocket-systems-in-lowndes-county/",
  "https://mississippi.org/news/spartan-composites-locating-manufacturing-operations-in-saltillo/",
  "https://mississippi.org/news/siemens-energy-expanding-presence-in-rankin-county-constructing-new-facility/",
  "https://mississippi.org/news/tech-leader-xai-investing-more-than-20-billion-in-southaven/",
];

const CITY_TO_COUNTY = {
  southaven: "DeSoto County",
  shannon: "Lee County",
  wiggins: "Stone County",
  saltillo: "Lee County",
};

const ARTICLE_OVERRIDES = new Map([
  [
    "southwark-metal-manufacturing-company-expanding-operations-in-desoto-county",
    {
      companyName: "Southwark Metal Manufacturing Company",
      city: "Southaven",
      countyName: "DeSoto County",
      amountUsd: 29_000_000,
      jobs: 25,
      techTags: ["advanced_manufacturing", "metals"],
    },
  ],
  [
    "defense-technology-leader-general-atomics-expanding-operations-in-shannon",
    {
      companyName: "General Atomics",
      city: "Shannon",
      countyName: "Lee County",
      amountUsd: 25_000_000,
      techTags: ["defense", "advanced_manufacturing", "aerospace"],
    },
  ],
  [
    "carpenter-pole-and-piling-expanding-in-stone-county",
    {
      companyName: "Carpenter Pole and Piling",
      city: "Wiggins",
      countyName: "Stone County",
      amountUsd: 5_000_000,
      jobs: 10,
      techTags: ["grid_infrastructure", "forestry_products", "advanced_manufacturing"],
    },
  ],
  [
    "firehawk-aerospace-to-manufacture-rocket-systems-in-lowndes-county",
    {
      companyName: "Firehawk Aerospace",
      countyName: "Lowndes County",
      amountUsd: 16_500_000,
      jobs: 100,
      techTags: ["aerospace", "defense", "advanced_manufacturing"],
    },
  ],
  [
    "spartan-composites-locating-manufacturing-operations-in-saltillo",
    {
      companyName: "Spartan Composites",
      city: "Saltillo",
      countyName: "Lee County",
      amountUsd: 49_000_000,
      jobs: 45,
      techTags: ["advanced_manufacturing", "materials", "mobility"],
    },
  ],
  [
    "siemens-energy-expanding-presence-in-rankin-county-constructing-new-facility",
    {
      companyName: "Siemens Energy",
      countyName: "Rankin County",
      amountUsd: 300_000_000,
      jobs: 300,
      techTags: ["energy", "grid_infrastructure", "advanced_manufacturing"],
    },
  ],
  [
    "tech-leader-xai-investing-more-than-20-billion-in-southaven",
    {
      companyName: "xAI",
      city: "Southaven",
      countyName: "DeSoto County",
      amountUsd: 20_000_000_000,
      techTags: ["ai", "data_center", "grid_infrastructure"],
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

function extractLocation(override) {
  return {
    city: override?.city || null,
    countyName:
      override?.countyName ||
      (override?.city ? CITY_TO_COUNTY[override.city.toLowerCase()] || null : null),
    label: `${override?.city || override?.countyName || "Mississippi"}, MS`,
  };
}

async function loadMississippiCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.MS&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`MS:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchMississippiProjectPage(url) {
  const userAgent =
    process.env.MISSISSIPPI_PROJECTS_USER_AGENT ||
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
      throw new Error(`Mississippi project fetch failed: ${response.status} ${url}`);
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
      "Mississippi strategic project",
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

export async function ingestMississippiMdaProjects() {
  const urls = readListEnv("MISSISSIPPI_PROJECT_URLS", DEFAULT_MISSISSIPPI_PROJECT_URLS);
  const countyMap = await loadMississippiCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchMississippiProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Mississippi Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override?.companyName || !override?.amountUsd) continue;

    const location = extractLocation(override);
    const geo =
      location.countyName
        ? countyMap.get(`MS:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "MS",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });

    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:mississippi-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:mississippi-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:mississippi-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:mississippi-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:mississippi-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:mississippi-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:mississippi-projects:${sourceNaturalId}`);
    const techTags = override.techTags || [];

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: override.companyName,
      normalized_name: normalizeName(override.companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 85,
      metadata: { source: sourceName },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: page.title,
      normalized_name: normalizeName(page.title),
      address: {
        city: location.city || undefined,
        state: "MS",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 86 : 74,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: location.label,
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
        location,
      },
      extraction_version: "mississippi-mda-projects-v1",
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
      provider_name: "Mississippi Development Authority",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "MS",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "MS",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "Mississippi Development Authority",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "mississippi_mda_override",
        matchedFacilityStrategy: geoId ? "mississippi_county_match" : "mississippi_state_or_city_only",
        notes: ["Official Mississippi Development Authority strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "mississippi_state_projects",
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
        state: "MS",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:mississippi-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:mississippi-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8600" : "0.7600",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        sectorAlignment: true,
        companyName: override.companyName,
        location,
        techTags,
      },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official Mississippi Development Authority strategic project announcement.",
    });
  }

  return bundle;
}
