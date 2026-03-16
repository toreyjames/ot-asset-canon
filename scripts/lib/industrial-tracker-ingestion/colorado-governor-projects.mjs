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

const DEFAULT_COLORADO_PROJECT_URLS = [
  "https://www.colorado.gov/governor/news/11301-growing-colorado-semiconductor-industry-microchip-expand-colorado-springs",
  "https://www.colorado.gov/governor/news/9291-advancing-colorados-semiconductor-industry-polis-administration-secures-entegris-colorado",
  "https://www.colorado.gov/governor/news/growing-colorados-semiconductor-industry-gov-polis-announces-okika-devices-expansion-colorado",
  "https://www.colorado.gov/governor/news/growing-colorados-leading-aerospace-industry-gov-polis-announces-digantara-expansion-colorado",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "11301-growing-colorado-semiconductor-industry-microchip-expand-colorado-springs",
    {
      records: [
        {
          companyName: "Microchip Technology",
          facilityName: "Microchip Colorado Springs Fab 5 Modernization and Expansion",
          city: "Colorado Springs",
          countyName: "El Paso County",
          amountUsd: 940_000_000,
          jobs: 400,
          techTags: ["semiconductor", "chips", "advanced_manufacturing", "defense"],
          sector: "semiconductors",
        },
      ],
    },
  ],
  [
    "9291-advancing-colorados-semiconductor-industry-polis-administration-secures-entegris-colorado",
    {
      records: [
        {
          companyName: "Entegris",
          facilityName: "Entegris Colorado Springs Semiconductor Manufacturing Facility",
          city: "Colorado Springs",
          countyName: "El Paso County",
          amountUsd: 600_000_000,
          jobs: 600,
          techTags: ["semiconductor", "advanced_materials", "advanced_manufacturing", "chips"],
          sector: "semiconductors",
        },
      ],
    },
  ],
  [
    "growing-colorados-semiconductor-industry-gov-polis-announces-okika-devices-expansion-colorado",
    {
      records: [
        {
          companyName: "Okika Devices",
          facilityName: "Okika Devices Colorado Springs Headquarters and R&D Center",
          city: "Colorado Springs",
          countyName: "El Paso County",
          amountUsd: 398_756,
          jobs: 20,
          techTags: ["semiconductor", "analog_chips", "research", "advanced_manufacturing"],
          sector: "semiconductors",
        },
      ],
    },
  ],
  [
    "growing-colorados-leading-aerospace-industry-gov-polis-announces-digantara-expansion-colorado",
    {
      records: [
        {
          companyName: "Digantara",
          facilityName: "Digantara Colorado Springs Satellite Assembly and Testing Facility",
          city: "Colorado Springs",
          countyName: "El Paso County",
          amountUsd: 35_000_000,
          jobs: 61,
          techTags: ["space", "aerospace", "defense", "advanced_manufacturing"],
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
  if (haystack.includes("semiconductor")) tags.add("semiconductor");
  if (haystack.includes("aerospace") || haystack.includes("space")) tags.add("aerospace");
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("defense")) tags.add("defense");
  return Array.from(tags);
}

async function loadColoradoCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.CO&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`CO:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchColoradoProjectPage(url) {
  const userAgent =
    process.env.COLORADO_PROJECTS_USER_AGENT ||
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
      throw new Error(`Colorado project fetch failed: ${response.status} ${url}`);
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
      "Colorado strategic project",
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

export async function ingestColoradoGovernorProjects() {
  const urls = readListEnv("COLORADO_PROJECT_URLS", DEFAULT_COLORADO_PROJECT_URLS);
  const countyMap = await loadColoradoCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchColoradoProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Colorado Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override?.records?.length) continue;

    for (const record of override.records) {
      const sourceNaturalId = `${page.url}#${normalizeName(record.companyName).replace(/\s+/g, "-")}`;
      const geo = countyMap.get(`CO:${normalizeCountyName(record.countyName)}`) || null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "CO",
        countyName: geo?.county_name || record.countyName,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
      const companyId = deterministicUuid(`entity:colorado-projects:${normalizeName(record.companyName)}`);
      const facilityId = deterministicUuid(`facility:colorado-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:colorado-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:colorado-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:colorado-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:colorado-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:colorado-projects:${sourceNaturalId}`);
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
          state: "CO",
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
          state: "CO",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: geoId ? 89 : 78,
        metadata: {
          source: sourceName,
          facility_type: "industrial_project_site",
          location_label: record.city ? `${record.city}, CO` : `${record.countyName}, CO`,
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
        extraction_version: "colorado-governor-projects-v1",
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
        provider_name: "State of Colorado",
        recipient_name: record.companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "CO",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || record.countyName,
          label: record.city ? `${record.city}, CO` : `${record.countyName}, CO`,
        },
        recipient_location: {
          city: record.city,
          state: "CO",
        },
        jobs_estimate: record.jobs || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        capex_estimate: record.amountUsd,
        program_name: sourceName,
        confidence_score: geoId ? 87 : 78,
        provenance: {
          matchedEntityStrategy: "colorado_governor_override",
          matchedFacilityStrategy: geoId ? "colorado_county_match" : "colorado_state_or_city_only",
          notes: ["Official Colorado strategic project announcement parsed from Governor press page."],
        },
      });

      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        dataset: "colorado_state_projects",
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
          state: "CO",
        },
      });

      bundle.facilityEventRows.push({
        id: deterministicUuid(`facility-event:colorado-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        signal_id: signalId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        metadata: {
          location_label: record.city ? `${record.city}, CO` : `${record.countyName}, CO`,
        },
      });

      bundle.programLinkRows.push({
        id: deterministicUuid(`program-link:colorado-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        program_type: "state_incentive",
        external_program_id: sourceNaturalId,
        agency: "State of Colorado",
        metadata: {
          source_url: page.url,
          sector: record.sector || "advanced_manufacturing",
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:colorado-projects:${sourceNaturalId}`),
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
        rationale: "Resolved from official Colorado strategic project announcement.",
      });
    }
  }

  return bundle;
}
