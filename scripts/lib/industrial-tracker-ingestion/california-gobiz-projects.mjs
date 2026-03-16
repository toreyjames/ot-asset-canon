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

const DEFAULT_CALIFORNIA_PROJECT_URLS = [
  "https://business.ca.gov/governor-newsom-highlights-anduril-industries-1-billion-expansion-in-southern-california/",
  "https://business.ca.gov/california-selected-as-headquarters-for-the-national-semiconductor-technology-center/",
  "https://business.ca.gov/global-biotech-leaders-amgen-and-gilead-announcing-expansions-in-california-the-1-state-for-life-sciences/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "governor-newsom-highlights-anduril-industries-1-billion-expansion-in-southern-california",
    {
      records: [
        {
          companyName: "Anduril Industries",
          facilityName: "Anduril Long Beach and Lakewood Campus",
          city: "Long Beach",
          countyName: "Los Angeles County",
          amountUsd: 1_000_000_000,
          jobs: 5500,
          techTags: ["defense", "aerospace", "advanced_manufacturing", "ai"],
          sector: "advanced_manufacturing",
        },
      ],
    },
  ],
  [
    "california-selected-as-headquarters-for-the-national-semiconductor-technology-center",
    {
      records: [
        {
          companyName: "Natcast",
          facilityName: "National Semiconductor Technology Center Design and Collaboration Facility",
          city: "Sunnyvale",
          countyName: "Santa Clara County",
          amountUsd: 1_000_000_000,
          jobs: 200,
          techTags: ["semiconductor", "research", "design", "chips"],
          sector: "semiconductors",
        },
      ],
    },
  ],
  [
    "global-biotech-leaders-amgen-and-gilead-announcing-expansions-in-california-the-1-state-for-life-sciences",
    {
      records: [
        {
          companyName: "Amgen",
          facilityName: "Amgen Thousand Oaks Research Center",
          city: "Thousand Oaks",
          countyName: "Ventura County",
          amountUsd: 600_000_000,
          jobs: null,
          techTags: ["life_sciences", "biotech", "research", "advanced_manufacturing"],
          sector: "life_sciences",
        },
        {
          companyName: "Gilead Sciences",
          facilityName: "Gilead Foster City Pharmaceutical Development and Manufacturing Center",
          city: "Foster City",
          countyName: "San Mateo County",
          amountUsd: 847_000_000,
          jobs: 2500,
          techTags: ["life_sciences", "biotech", "manufacturing", "pharmaceuticals"],
          sector: "life_sciences",
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
  if (haystack.includes("semiconductor")) tags.add("semiconductor");
  if (haystack.includes("biotech") || haystack.includes("pharmaceutical")) tags.add("life_sciences");
  if (haystack.includes("defense") || haystack.includes("aerospace")) tags.add("defense");
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  return Array.from(tags);
}

async function loadCaliforniaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.CA&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`CA:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchCaliforniaProjectPage(url) {
  const userAgent =
    process.env.CALIFORNIA_PROJECTS_USER_AGENT ||
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
      throw new Error(`California project fetch failed: ${response.status} ${url}`);
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
      "California strategic project",
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

export async function ingestCaliforniaGobizProjects() {
  const urls = readListEnv("CALIFORNIA_PROJECT_URLS", DEFAULT_CALIFORNIA_PROJECT_URLS);
  const countyMap = await loadCaliforniaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchCaliforniaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "California Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override?.records?.length) continue;

    for (const record of override.records) {
      const sourceNaturalId = `${page.url}#${normalizeName(record.companyName).replace(/\s+/g, "-")}`;
      const geo = countyMap.get(`CA:${normalizeCountyName(record.countyName)}`) || null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "CA",
        countyName: geo?.county_name || record.countyName,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
      const companyId = deterministicUuid(`entity:california-projects:${normalizeName(record.companyName)}`);
      const facilityId = deterministicUuid(`facility:california-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:california-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:california-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:california-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:california-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:california-projects:${sourceNaturalId}`);
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
          state: "CA",
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
          state: "CA",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: geoId ? 89 : 78,
        metadata: {
          source: sourceName,
          facility_type: "industrial_project_site",
          location_label: record.city ? `${record.city}, CA` : `${record.countyName}, CA`,
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
        extraction_version: "california-gobiz-projects-v1",
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
        provider_name: "California GO-Biz",
        recipient_name: record.companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "CA",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || record.countyName,
          label: record.city ? `${record.city}, CA` : `${record.countyName}, CA`,
        },
        recipient_location: {
          city: record.city,
          state: "CA",
        },
        jobs_estimate: record.jobs || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        capex_estimate: record.amountUsd,
        program_name: sourceName,
        confidence_score: geoId ? 87 : 78,
        provenance: {
          matchedEntityStrategy: "california_gobiz_override",
          matchedFacilityStrategy: geoId ? "california_county_match" : "california_state_or_city_only",
          notes: ["Official California GO-Biz strategic project announcement parsed from article HTML."],
        },
      });

      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        dataset: "california_state_projects",
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
          tech_tags: techTags,
          state: "CA",
        },
      });

      bundle.facilityEventRows.push({
        id: deterministicUuid(`facility-event:california-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        signal_id: signalId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        metadata: {
          location_label: record.city ? `${record.city}, CA` : `${record.countyName}, CA`,
        },
      });

      bundle.programLinkRows.push({
        id: deterministicUuid(`program-link:california-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        program_type: "state_incentive",
        external_program_id: sourceNaturalId,
        agency: "California GO-Biz",
        metadata: {
          source_url: page.url,
          sector: record.sector || "advanced_manufacturing",
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:california-projects:${sourceNaturalId}`),
        source_record_id: sourceRecordId,
        entity_id: companyId,
        facility_id: facilityId,
        decision_type: "deterministic",
        score: geoId ? "0.8900" : "0.7800",
        features: {
          exactIdentifiers: [],
          nameSimilarity: 1,
          sectorAlignment: true,
          companyName: record.companyName,
          location: {
            city: record.city,
            countyName: record.countyName,
          },
          techTags,
        },
        candidate_set: [companyId, facilityId],
        chosen: true,
        rationale: "Resolved from official California GO-Biz strategic project announcement.",
      });
    }
  }

  return bundle;
}
