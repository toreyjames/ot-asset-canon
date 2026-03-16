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

const DEFAULT_WASHINGTON_PROJECT_URLS = [
  "https://www.commerce.wa.gov/governor-ferguson-awards-350k-to-portal-space-systems-for-bothell-expansion/",
  "https://www.commerce.wa.gov/making-things-happen-for-sustainability-and-jobs-port-of-walla-walla-secures-state-support-to-ramp-up-sustainable-aviation-fuels-production-and-new-jobs/",
  "https://www.commerce.wa.gov/twelve-announces-plans-to-scale-production-of-sustainable-aviation-fuel-made-from-co2-in-washington-state/",
  "https://www.commerce.wa.gov/tool-gauge-taps-state-work-start-grant-to-keep-pace-with-expansion/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "governor-ferguson-awards-350k-to-portal-space-systems-for-bothell-expansion",
    {
      records: [
        {
          companyName: "Portal Space Systems",
          facilityName: "Portal Space Systems Bothell Satellite Manufacturing Facility",
          city: "Bothell",
          countyName: "Snohomish County",
          amountUsd: 350_000,
          jobs: 700,
          techTags: ["space", "aerospace", "defense", "advanced_manufacturing"],
          sector: "advanced_manufacturing",
        },
      ],
    },
  ],
  [
    "making-things-happen-for-sustainability-and-jobs-port-of-walla-walla-secures-state-support-to-ramp-up-sustainable-aviation-fuels-production-and-new-jobs",
    {
      records: [
        {
          companyName: "SkyNRG Americas",
          facilityName: "SkyNRG Americas Wallula Gap Sustainable Aviation Fuel Facility",
          city: "Wallula",
          countyName: "Walla Walla County",
          amountUsd: 1_500_000,
          jobs: 100,
          techTags: ["clean_energy", "renewable_fuels", "aerospace", "advanced_manufacturing"],
          sector: "advanced_manufacturing",
        },
      ],
    },
  ],
  [
    "twelve-announces-plans-to-scale-production-of-sustainable-aviation-fuel-made-from-co2-in-washington-state",
    {
      records: [
        {
          companyName: "Twelve",
          facilityName: "Twelve Moses Lake E-Jet Fuel Production Facility",
          city: "Moses Lake",
          countyName: "Grant County",
          amountUsd: 650_000_000,
          jobs: 250,
          techTags: ["clean_energy", "renewable_fuels", "aerospace", "advanced_manufacturing"],
          sector: "advanced_manufacturing",
        },
      ],
    },
  ],
  [
    "tool-gauge-taps-state-work-start-grant-to-keep-pace-with-expansion",
    {
      records: [
        {
          companyName: "Tool Gauge",
          facilityName: "Tool Gauge Tacoma Aerospace Manufacturing Expansion",
          city: "Tacoma",
          countyName: "Pierce County",
          amountUsd: 125_000,
          jobs: 100,
          techTags: ["aerospace", "advanced_manufacturing", "precision_manufacturing", "defense"],
          sector: "advanced_manufacturing",
        },
      ],
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
  if (haystack.includes("space")) tags.add("space");
  if (haystack.includes("aerospace") || haystack.includes("aviation")) tags.add("aerospace");
  if (haystack.includes("fuel") || haystack.includes("saf")) tags.add("renewable_fuels");
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("defense")) tags.add("defense");
  return Array.from(tags);
}

async function loadWashingtonCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.WA&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`WA:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchWashingtonProjectPage(url) {
  const userAgent =
    process.env.WASHINGTON_PROJECTS_USER_AGENT ||
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
      throw new Error(`Washington project fetch failed: ${response.status} ${url}`);
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
      "Washington strategic project",
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

export async function ingestWashingtonCommerceProjects() {
  const urls = readListEnv("WASHINGTON_PROJECT_URLS", DEFAULT_WASHINGTON_PROJECT_URLS);
  const countyMap = await loadWashingtonCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchWashingtonProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Washington Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override?.records?.length) continue;

    for (const record of override.records) {
      const sourceNaturalId = `${page.url}#${normalizeName(record.companyName).replace(/\s+/g, "-")}`;
      const geo = countyMap.get(`WA:${normalizeCountyName(record.countyName)}`) || null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "WA",
        countyName: geo?.county_name || record.countyName,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
      const companyId = deterministicUuid(`entity:washington-projects:${normalizeName(record.companyName)}`);
      const facilityId = deterministicUuid(`facility:washington-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:washington-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:washington-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:washington-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:washington-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:washington-projects:${sourceNaturalId}`);
      const techTags = buildTechTags(page.title, page.description, page.text, record);

      if (geoRow) bundle.geoRows.push(geoRow);

      bundle.entityRows.push({
        id: companyId,
        legal_name: record.companyName,
        normalized_name: normalizeName(record.companyName),
        entity_type: "company",
        country: "US",
        identifiers: {},
        aliases: [],
        confidence_score: 88,
        metadata: {
          source: sourceName,
          state: "WA",
        },
      });

      bundle.facilityRows.push({
        id: facilityId,
        entity_id: companyId,
        geo_id: geoId,
        facility_name: record.facilityName,
        normalized_name: normalizeName(record.facilityName),
        address: {
          city: record.city,
          state: "WA",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: geoId ? 89 : 78,
        metadata: {
          source: sourceName,
          facility_type: "industrial_project_site",
          location_label: record.city ? `${record.city}, WA` : `${record.countyName}, WA`,
          tech_tags: techTags,
        },
      });

      bundle.sourceRows.push({
        id: sourceRecordId,
        source_system: sourceName,
        source_record_id: sourceNaturalId,
        source_category: "incentive",
        source_url: page.url,
        source_hash: sha256(JSON.stringify({ page, record })),
        fetched_at: new Date().toISOString(),
        effective_date: observedAt,
        raw_payload: {
          title: page.title,
          description: page.description,
          companyName: record.companyName,
          amount: record.amountUsd,
          jobs: record.jobs || null,
          location: {
            city: record.city,
            countyName: record.countyName,
          },
        },
        extraction_version: "washington-commerce-projects-v1",
      });

      bundle.projectRows.push({
        id: projectId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_type: "state_strategic_project",
        sector: record.sector || techTags[0] || "industrial",
        status: "active",
        investment_amount: record.amountUsd,
        announcement_date: observedAt,
        construction_start: null,
        completion_estimate: null,
        metadata: {
          source: sourceName,
          jobs_estimate: record.jobs || null,
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
        amount: String(record.amountUsd),
        amount_type: "commitment",
        currency: "USD",
        announced_date: observedAt,
        action_date: observedAt,
        start_date: null,
        end_date: null,
        provider_entity_id: null,
        recipient_entity_id: companyId,
        facility_id: facilityId,
        provider_name: "State of Washington",
        recipient_name: record.companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "WA",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || record.countyName,
          label: record.city ? `${record.city}, WA` : `${record.countyName}, WA`,
        },
        recipient_location: {
          city: record.city,
          state: "WA",
        },
        jobs_estimate: record.jobs || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        capex_estimate: record.amountUsd,
        program_name: sourceName,
        confidence_score: geoId ? 87 : 78,
        provenance: {
          matchedEntityStrategy: "washington_commerce_override",
          matchedFacilityStrategy: geoId ? "washington_county_match" : "washington_state_or_city_only",
          notes: ["Official Washington strategic project announcement parsed from Commerce press page."],
        },
      });

      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        dataset: "washington_state_projects",
        source_name: sourceName,
        evidence_type: "state_incentive_announced",
        observed_at: observedAt,
        confidence_score: 87,
        source_url: page.url,
        raw_payload: {
          title: page.title,
          amount: record.amountUsd,
          jobs: record.jobs || null,
        },
      });

      bundle.signalRows.push({
        id: signalId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        signal_type: "state_incentive_recorded",
        value: String(record.amountUsd),
        unit: "USD",
        evidence_id: evidenceId,
        observed_at: observedAt,
        metadata: {
          jobs: record.jobs || null,
          source: sourceName,
          tech_tags: techTags,
        },
      });

      bundle.programLinkRows.push({
        id: deterministicUuid(`program-link:washington-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        program_type: "state_incentive",
        external_program_id: sourceNaturalId,
        agency: "State of Washington",
        metadata: {
          amount: record.amountUsd,
          jobs: record.jobs || null,
          source_url: page.url,
          sector: record.sector || "advanced_manufacturing",
        },
      });

      bundle.facilityEventRows.push({
        id: deterministicUuid(`facility-event:washington-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        signal_id: signalId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        metadata: {
          amount: record.amountUsd,
          jobs: record.jobs || null,
          location_label: record.city ? `${record.city}, WA` : `${record.countyName}, WA`,
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:washington-projects:${sourceNaturalId}`),
        source_record_id: sourceRecordId,
        entity_id: companyId,
        facility_id: facilityId,
        decision_type: "deterministic",
        score: geoId ? "0.9000" : "0.7800",
        features: {
          exactIdentifiers: [],
          nameSimilarity: 1,
          sectorAlignment: true,
          companyName: record.companyName,
          facilityName: record.facilityName,
          location: {
            city: record.city,
            countyName: record.countyName,
            stateCode: "WA",
          },
          techTags,
        },
        candidate_set: [companyId, facilityId],
        chosen: true,
        rationale: "Resolved from official Washington strategic project announcement.",
      });
    }
  }

  return bundle;
}
