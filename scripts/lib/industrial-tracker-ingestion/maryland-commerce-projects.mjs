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

const DEFAULT_MARYLAND_PROJECT_URLS = [
  "https://commerce.maryland.gov/media/governor-moore-announces-astrazeneca-to-expand-manufacturing-operations-in-montgomery-county",
  "https://commerce.maryland.gov/media/governor-moore-announces-new-bakery-de-france-manufacturing-facility-in-frederick",
  "https://commerce.maryland.gov/media/governor-moore-announces-new-steel-pile-fabrication-factory-at-tradepoint-atlantic-creating-150-manufacturing-jobs",
  "https://commerce.maryland.gov/media/governor-moore-welcomes-first-samsung-biologics-us-manufacturing-site-with-facility-to-open-in-rockville",
  "https://commerce.maryland.gov/media/governor-moore-announces-pwrq-expansion-with-160-new-jobs-in-anne-arundel-county",
  "https://commerce.maryland.gov/media/governor-moore-announces-new-sj-incorporation-manufacturing-facility-in-washington-county",
  "https://commerce.maryland.gov/media/governor-moore-welcomes-newcold-and-more-than-100-jobs-to-maryland",
  "https://commerce.maryland.gov/media/governor-moore-announces-major-xenergy-investments-in-montgomery-and-frederick-counties",
  "https://commerce.maryland.gov/media/governor-moore-announces-bluehalo-to-expand-operations-adding-200-new-jobs-in-maryland",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "governor-moore-announces-astrazeneca-to-expand-manufacturing-operations-in-montgomery-county",
    {
      companyName: "AstraZeneca",
      facilityName: "AstraZeneca Rockville Cell Therapy Facility",
      city: "Rockville",
      countyName: "Montgomery County",
      amountUsd: 300_000_000,
      jobs: 150,
      techTags: ["life_sciences", "pharmaceuticals", "biomanufacturing", "advanced_manufacturing"],
    },
  ],
  [
    "governor-moore-announces-new-bakery-de-france-manufacturing-facility-in-frederick",
    {
      companyName: "Bakery de France",
      facilityName: "Bakery de France Frederick Manufacturing Facility",
      city: "Frederick",
      countyName: "Frederick County",
      amountUsd: 65_000_000,
      jobs: 125,
      techTags: ["food", "advanced_manufacturing", "consumer_manufacturing"],
    },
  ],
  [
    "governor-moore-announces-new-steel-pile-fabrication-factory-at-tradepoint-atlantic-creating-150-manufacturing-jobs",
    {
      companyName: "JD Fields HDM Spiralweld Mill, LLC",
      facilityName: "JD Fields Tradepoint Atlantic Fabrication Center",
      city: "Sparrows Point",
      countyName: "Baltimore County",
      amountUsd: 50_000_000,
      jobs: 150,
      techTags: ["metals", "port_infrastructure", "advanced_manufacturing"],
    },
  ],
  [
    "governor-moore-welcomes-first-samsung-biologics-us-manufacturing-site-with-facility-to-open-in-rockville",
    {
      companyName: "Samsung Biologics",
      facilityName: "Samsung Biologics Rockville Manufacturing Site",
      city: "Rockville",
      countyName: "Montgomery County",
      amountUsd: 2_000_000_000,
      jobs: 500,
      techTags: ["life_sciences", "biotech", "biomanufacturing", "advanced_manufacturing"],
    },
  ],
  [
    "governor-moore-announces-pwrq-expansion-with-160-new-jobs-in-anne-arundel-county",
    {
      companyName: "PwrQ",
      facilityName: "PwrQ Hanover Headquarters and Manufacturing Expansion",
      city: "Hanover",
      countyName: "Anne Arundel County",
      amountUsd: 80_000_000,
      jobs: 160,
      techTags: ["power_systems", "critical_infrastructure", "advanced_manufacturing", "data_center"],
    },
  ],
  [
    "governor-moore-announces-new-sj-incorporation-manufacturing-facility-in-washington-county",
    {
      companyName: "SJ Incorporation",
      facilityName: "SJ Incorporation Cascade Production Facility",
      city: "Cascade",
      countyName: "Washington County",
      amountUsd: 70_000_000,
      jobs: 300,
      techTags: ["medical_devices", "life_sciences", "advanced_manufacturing"],
    },
  ],
  [
    "governor-moore-welcomes-newcold-and-more-than-100-jobs-to-maryland",
    {
      companyName: "NewCold",
      facilityName: "NewCold Hagerstown Automated Cold Storage Facility",
      city: "Hagerstown",
      countyName: "Washington County",
      amountUsd: 275_000_000,
      jobs: 150,
      techTags: ["cold_chain", "food", "automation", "logistics_infrastructure"],
    },
  ],
  [
    "governor-moore-announces-major-xenergy-investments-in-montgomery-and-frederick-counties",
    {
      companyName: "X-energy",
      facilityName: "X-energy Gaithersburg Headquarters Expansion",
      city: "Gaithersburg",
      countyName: "Montgomery County",
      amountUsd: 250_000_000,
      jobs: 525,
      techTags: ["nuclear", "advanced_energy", "advanced_manufacturing"],
    },
  ],
  [
    "governor-moore-announces-bluehalo-to-expand-operations-adding-200-new-jobs-in-maryland",
    {
      companyName: "BlueHalo",
      facilityName: "BlueHalo Germantown R&D and Manufacturing Facility",
      city: "Germantown",
      countyName: "Montgomery County",
      amountUsd: 120_000_000,
      jobs: 200,
      techTags: ["defense", "advanced_manufacturing", "electronics", "autonomy"],
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

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("biologic")) tags.add("biotech");
  if (haystack.includes("cold storage")) tags.add("cold_chain");
  if (haystack.includes("nuclear")) tags.add("nuclear");
  return Array.from(tags);
}

async function loadMarylandCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.MD&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`MD:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchMarylandProjectPage(url) {
  const userAgent =
    process.env.MARYLAND_PROJECTS_USER_AGENT ||
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
      throw new Error(`Maryland project fetch failed: ${response.status} ${url}`);
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
      "Maryland strategic project",
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

export async function ingestMarylandCommerceProjects() {
  const urls = readListEnv("MARYLAND_PROJECT_URLS", DEFAULT_MARYLAND_PROJECT_URLS);
  const countyMap = await loadMarylandCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchMarylandProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Maryland Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`MD:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "MD",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:maryland-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:maryland-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:maryland-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:maryland-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:maryland-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:maryland-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:maryland-projects:${sourceNaturalId}`);
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
        state: "MD",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 88 : 77,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: `${override.city}, MD`,
        tech_tags: techTags,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: page.url,
      source_category: "incentive",
      source_url: page.url,
      source_hash: sha256(JSON.stringify(page)),
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
          label: `${override.city}, MD`,
        },
      },
      extraction_version: "maryland-commerce-projects-v1",
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
      provider_name: "Maryland Department of Commerce",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "MD",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: `${override.city}, MD`,
      },
      recipient_location: {
        city: override.city,
        state: "MD",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "Maryland Commerce Strategic Projects",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "maryland_commerce_override",
        matchedFacilityStrategy: geoId ? "maryland_county_match" : "maryland_state_or_city_only",
        notes: ["Official Maryland Department of Commerce project announcement parsed from article HTML."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "maryland_state_projects",
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
        state: "MD",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:maryland-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: `${override.city}, MD`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:maryland-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official Maryland Commerce project announcement.",
    });
  }

  return bundle;
}
