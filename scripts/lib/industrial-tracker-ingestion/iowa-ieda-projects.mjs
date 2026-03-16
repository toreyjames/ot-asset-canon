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

const DEFAULT_IOWA_PROJECT_URLS = [
  "https://opportunityiowa.gov/press-release/2026-02-20/ieda-board-approves-first-big-incentives-five-companies-plus-quality-life-and-innovation-projects",
  "https://opportunityiowa.gov/press-release/2025-12-19/ieda-board-approves-funding-companies-quality-life-initiatives-and-startup-services",
  "https://opportunityiowa.gov/press-release/2025-11-21/ieda-board-approves-assistance-three-companies-quality-life-projects-and-amended-reinvestment",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "2026-02-20/ieda-board-approves-first-big-incentives-five-companies-plus-quality-life-and-innovation-projects",
    [
      {
        slug: "arconic-bettendorf",
        companyName: "Arconic Corp.",
        facilityName: "Arconic Davenport Works Casting Complex",
        city: "Bettendorf",
        countyName: "Scott County",
        amountUsd: 131_000_000,
        jobs: 40,
        techTags: ["metals", "advanced_manufacturing", "recycling", "defense"],
      },
      {
        slug: "vermeer-bondurant",
        companyName: "Vermeer Corp.",
        facilityName: "Vermeer Bondurant Production Facility",
        city: "Bondurant",
        countyName: "Polk County",
        amountUsd: 102_700_000,
        jobs: 182,
        techTags: ["industrial_equipment", "agriculture", "advanced_manufacturing"],
      },
      {
        slug: "ccb-packaging-hiawatha",
        companyName: "CCB Packaging",
        facilityName: "CCB Packaging Hiawatha Expansion",
        city: "Hiawatha",
        countyName: "Linn County",
        amountUsd: 13_300_000,
        jobs: 9,
        techTags: ["packaging", "food", "pharmaceuticals", "advanced_manufacturing"],
      },
      {
        slug: "sewer-equipment-vinton",
        companyName: "Sewer Equipment Company of America",
        facilityName: "Sewer Equipment Vinton Fabrication Facility",
        city: "Vinton",
        countyName: "Benton County",
        amountUsd: 3_000_000,
        jobs: 30,
        techTags: ["industrial_equipment", "water_infrastructure", "advanced_manufacturing"],
      },
      {
        slug: "revolution-concrete-waverly",
        companyName: "Revolution Concrete Mixers",
        facilityName: "Revolution Concrete Mixers Waverly Facility",
        city: "Waverly",
        countyName: "Bremer County",
        amountUsd: 18_200_000,
        jobs: 275,
        techTags: ["industrial_equipment", "construction", "advanced_manufacturing", "connected_systems"],
      },
    ],
  ],
  [
    "2025-12-19/ieda-board-approves-funding-companies-quality-life-initiatives-and-startup-services",
    [
      {
        slug: "morrison-coralville",
        companyName: "Morrison Weighing Systems, Inc.",
        facilityName: "Morrison Weighing Systems Coralville Facility",
        city: "Coralville",
        countyName: "Johnson County",
        amountUsd: 1_500_000,
        jobs: 11,
        techTags: ["food", "industrial_equipment", "automation", "advanced_manufacturing"],
      },
      {
        slug: "electro-freeze-davenport",
        companyName: "Electro Freeze",
        facilityName: "Electro Freeze Davenport Facility",
        city: "Davenport",
        countyName: "Scott County",
        amountUsd: 7_000_000,
        jobs: 200,
        techTags: ["foodservice_equipment", "industrial_equipment", "advanced_manufacturing"],
      },
      {
        slug: "sioux-honey-sioux-city",
        companyName: "Sioux Honey Association",
        facilityName: "Sioux Honey Sioux City Expansion",
        city: "Sioux City",
        countyName: "Woodbury County",
        amountUsd: 130_000_000,
        jobs: 70,
        techTags: ["food", "consumer_manufacturing", "advanced_manufacturing", "agriculture"],
      },
    ],
  ],
  [
    "2025-11-21/ieda-board-approves-assistance-three-companies-quality-life-projects-and-amended-reinvestment",
    [
      {
        slug: "kraft-heinz-muscatine",
        companyName: "Kraft Heinz",
        facilityName: "Kraft Heinz Muscatine Modernization",
        city: "Muscatine",
        countyName: "Muscatine County",
        amountUsd: 48_000_000,
        jobs: 404,
        techTags: ["food", "consumer_manufacturing", "advanced_manufacturing"],
      },
    ],
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
  const parts = String(url).split("/press-release/");
  return parts[1] || String(url).split("/").filter(Boolean).slice(-2).join("/");
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("packag")) tags.add("packaging");
  if (haystack.includes("aluminum")) tags.add("metals");
  if (haystack.includes("weigh")) tags.add("automation");
  return Array.from(tags);
}

async function loadIowaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.IA&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`IA:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchIowaProjectPage(url) {
  const userAgent =
    process.env.IOWA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Iowa project fetch failed: ${response.status} ${url}`);
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
      "Iowa strategic project",
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

export async function ingestIowaIedaProjects() {
  const urls = readListEnv("IOWA_PROJECT_URLS", DEFAULT_IOWA_PROJECT_URLS);
  const countyMap = await loadIowaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchIowaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Iowa Strategic Projects";

  for (const page of pages) {
    const entries = ARTICLE_OVERRIDES.get(page.slug) || [];

    for (const entry of entries) {
      const geo = countyMap.get(`IA:${normalizeCountyName(entry.countyName)}`) || null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "IA",
        countyName: geo?.county_name || entry.countyName,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
      const sourceNaturalId = `${page.url}#${entry.slug}`;
      const companyId = deterministicUuid(`entity:iowa-projects:${normalizeName(entry.companyName)}`);
      const facilityId = deterministicUuid(`facility:iowa-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:iowa-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:iowa-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:iowa-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:iowa-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:iowa-projects:${sourceNaturalId}`);
      const techTags = buildTechTags(page.title, page.description, page.text, entry);

      if (geoRow) bundle.geoRows.push(geoRow);

      bundle.entityRows.push({
        id: companyId,
        legal_name: entry.companyName,
        normalized_name: normalizeName(entry.companyName),
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
        facility_name: entry.facilityName,
        normalized_name: normalizeName(entry.facilityName),
        address: {
          city: entry.city,
          state: "IA",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: geoId ? 88 : 77,
        metadata: {
          source: sourceName,
          facility_type: "industrial_project_site",
          location_label: `${entry.city}, IA`,
          tech_tags: techTags,
        },
      });

      bundle.sourceRows.push({
        id: sourceRecordId,
        source_system: sourceName,
        source_record_id: sourceNaturalId,
        source_category: "incentive",
        source_url: page.url,
        source_hash: sha256(JSON.stringify({ page: page.url, entry })),
        fetched_at: new Date().toISOString(),
        effective_date: observedAt,
        raw_payload: {
          title: page.title,
          description: page.description,
          entry,
        },
        extraction_version: "iowa-ieda-projects-v1",
      });

      bundle.projectRows.push({
        id: projectId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_type: "industrial_expansion",
        sector: techTags[0] || "industrial",
        status: "announced",
        investment_amount: entry.amountUsd,
        announcement_date: observedAt,
        construction_start: null,
        completion_estimate: null,
        metadata: {
          location_label: `${entry.city}, IA`,
          jobs_estimate: entry.jobs || null,
          tech_tags: techTags,
          source_url: page.url,
          program_name: "IEDA BIG/HQJ",
        },
      });

      bundle.investmentRows.push({
        id: eventId,
        source_record_id: sourceRecordId,
        geo_id: geoId,
        taxonomy_id: null,
        event_type: "strategic_capital_commitment",
        amount: String(entry.amountUsd),
        amount_type: "commitment",
        currency: "USD",
        announced_date: observedAt,
        action_date: observedAt,
        start_date: null,
        end_date: null,
        provider_entity_id: null,
        recipient_entity_id: companyId,
        facility_id: facilityId,
        provider_name: "Iowa Economic Development Authority",
        recipient_name: entry.companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "IA",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || entry.countyName,
          label: `${entry.city}, IA`,
        },
        recipient_location: {
          city: entry.city,
          state: "IA",
        },
        jobs_estimate: entry.jobs || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        capex_estimate: entry.amountUsd,
        program_name: "IEDA BIG/HQJ",
        confidence_score: geoId ? 86 : 74,
        provenance: {
          matchedEntityStrategy: "iowa_ieda_override",
          matchedFacilityStrategy: geoId ? "iowa_county_match" : "iowa_state_or_city_only",
          notes: ["Official Iowa Economic Development Authority board-approved strategic project announcement parsed from public release."],
        },
      });

      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        dataset: "iowa_state_projects",
        source_name: sourceName,
        evidence_type: "state_incentive_announced",
        observed_at: observedAt,
        confidence_score: 86,
        source_url: page.url,
        raw_payload: {
          title: page.title,
          amount: entry.amountUsd,
          jobs: entry.jobs || null,
          entry,
        },
      });

      bundle.signalRows.push({
        id: signalId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        signal_type: "state_incentive_recorded",
        value: String(entry.amountUsd),
        unit: "USD",
        evidence_id: evidenceId,
        observed_at: observedAt,
        metadata: {
          jobs: entry.jobs || null,
          state: "IA",
          tech_tags: techTags,
        },
      });

      bundle.facilityEventRows.push({
        id: deterministicUuid(`facility-event:iowa-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        signal_id: signalId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        metadata: {
          location_label: `${entry.city}, IA`,
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:iowa-projects:${sourceNaturalId}`),
        source_record_id: sourceRecordId,
        entity_id: companyId,
        facility_id: facilityId,
        decision_type: "deterministic",
        score: geoId ? "0.9400" : "0.8200",
        features: {
          exactIdentifiers: [],
          nameSimilarity: 1,
          sectorAlignment: true,
          companyName: entry.companyName,
          countyName: entry.countyName,
          city: entry.city,
          techTags,
        },
        candidate_set: [companyId, facilityId],
        chosen: true,
        rationale: "Official IEDA board-approved project release with curated company and county mapping.",
      });
    }
  }

  return bundle;
}
