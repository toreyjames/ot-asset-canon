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

const DEFAULT_OREGON_PROJECT_URLS = [
  "https://www.oregon.gov/biz/newsroom/pages/timberlab-builds-new-facility-in-millersburg.aspx",
  "https://www.oregon.gov/biz/newsroom/pages/hp-chips.aspx",
  "https://www.oregon.gov/biz/newsroom/pages/success_stories/pacific-stainless-products-receives-%241.5-million-award-from-business-oregon.aspx",
  "https://www.oregon.gov/biz/newsroom/Pages/Westgate.aspx",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "timberlab-builds-new-facility-in-millersburg.aspx",
    {
      records: [
        {
          companyName: "Timberlab",
          facilityName: "Timberlab Millersburg CLT Manufacturing Facility",
          city: "Millersburg",
          countyName: "Linn County",
          amountUsd: 720_000,
          jobs: 100,
          techTags: ["advanced_manufacturing", "mass_timber", "construction_materials", "industrial"],
          sector: "advanced_manufacturing",
        },
      ],
    },
  ],
  [
    "hp-chips.aspx",
    {
      records: [
        {
          companyName: "HP, Inc.",
          facilityName: "HP Corvallis Microfluidics Technology Expansion",
          city: "Corvallis",
          countyName: "Benton County",
          amountUsd: 9_500_000,
          jobs: null,
          techTags: ["semiconductor", "microfluidics", "advanced_manufacturing", "life_sciences"],
          sector: "semiconductors",
        },
      ],
    },
  ],
  [
    "pacific-stainless-products-receives-%241.5-million-award-from-business-oregon.aspx",
    {
      records: [
        {
          companyName: "Pacific Stainless Products",
          facilityName: "Pacific Stainless Products St. Helens Semiconductor Supply Expansion",
          city: "St. Helens",
          countyName: "Columbia County",
          amountUsd: 1_500_000,
          jobs: null,
          techTags: ["semiconductor", "metal_fabrication", "advanced_manufacturing", "aerospace"],
          sector: "advanced_manufacturing",
        },
      ],
    },
  ],
  [
    "Westgate.aspx",
    {
      records: [
        {
          companyName: "Collaborative Economic Development Oregon",
          facilityName: "Westgate Eugene Semiconductor Industrial Land Site",
          city: "Eugene",
          countyName: "Lane County",
          amountUsd: 500_000,
          jobs: null,
          techTags: ["semiconductor", "industrial_land", "infrastructure", "advanced_manufacturing"],
          sector: "infrastructure",
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
  if (haystack.includes("semiconductor") || haystack.includes("chips")) tags.add("semiconductor");
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("aerospace")) tags.add("aerospace");
  if (haystack.includes("timber")) tags.add("mass_timber");
  if (haystack.includes("infrastructure")) tags.add("infrastructure");
  return Array.from(tags);
}

async function loadOregonCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.OR&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`OR:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchOregonProjectPage(url) {
  const userAgent =
    process.env.OREGON_PROJECTS_USER_AGENT ||
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
      throw new Error(`Oregon project fetch failed: ${response.status} ${url}`);
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
      "Oregon strategic project",
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

export async function ingestOregonBusinessProjects() {
  const urls = readListEnv("OREGON_PROJECT_URLS", DEFAULT_OREGON_PROJECT_URLS);
  const countyMap = await loadOregonCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchOregonProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Oregon Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override?.records?.length) continue;

    for (const record of override.records) {
      const sourceNaturalId = `${page.url}#${normalizeName(record.companyName).replace(/\s+/g, "-")}`;
      const geo = countyMap.get(`OR:${normalizeCountyName(record.countyName)}`) || null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "OR",
        countyName: geo?.county_name || record.countyName,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
      const companyId = deterministicUuid(`entity:oregon-projects:${normalizeName(record.companyName)}`);
      const facilityId = deterministicUuid(`facility:oregon-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:oregon-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:oregon-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:oregon-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:oregon-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:oregon-projects:${sourceNaturalId}`);
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
          state: "OR",
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
          state: "OR",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: geoId ? 89 : 78,
        metadata: {
          source: sourceName,
          facility_type: "industrial_project_site",
          location_label: record.city ? `${record.city}, OR` : `${record.countyName}, OR`,
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
        extraction_version: "oregon-business-projects-v1",
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
        provider_name: "State of Oregon",
        recipient_name: record.companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "OR",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || record.countyName,
          label: record.city ? `${record.city}, OR` : `${record.countyName}, OR`,
        },
        recipient_location: {
          city: record.city,
          state: "OR",
        },
        jobs_estimate: record.jobs || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        capex_estimate: record.amountUsd,
        program_name: sourceName,
        confidence_score: geoId ? 87 : 78,
        provenance: {
          matchedEntityStrategy: "oregon_business_override",
          matchedFacilityStrategy: geoId ? "oregon_county_match" : "oregon_state_or_city_only",
          notes: ["Official Oregon Business newsroom announcement parsed from state page."],
        },
      });

      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        dataset: "oregon_state_projects",
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
          state: "OR",
          tech_tags: techTags,
        },
      });

      bundle.facilityEventRows.push({
        id: deterministicUuid(`facility-event:oregon-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        signal_id: signalId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        metadata: {
          location_label: record.city ? `${record.city}, OR` : `${record.countyName}, OR`,
        },
      });

      bundle.programLinkRows.push({
        id: deterministicUuid(`program-link:oregon-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        program_type: "state_incentive",
        external_program_id: sourceNaturalId,
        agency: "Business Oregon",
        metadata: {
          source_url: page.url,
          sector: record.sector || "advanced_manufacturing",
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:oregon-projects:${sourceNaturalId}`),
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
            stateCode: "OR",
          },
          techTags,
        },
        candidate_set: [companyId, facilityId],
        chosen: true,
        rationale: "Resolved from official Oregon Business strategic project announcement.",
      });
    }
  }

  return bundle;
}
