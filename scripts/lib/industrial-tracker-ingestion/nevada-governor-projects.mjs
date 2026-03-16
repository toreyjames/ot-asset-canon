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

const DEFAULT_NEVADA_PROJECT_URLS = [
  "https://gov.nv.gov/Newsroom/PRs/2024/2024-05-23_governor-joe-lombardo-announce-over-270-new-jobs/",
  "https://gov.nv.gov/Newsroom/PRs/2024/2024-01-25_newjobs/",
  "https://gov.nv.gov/Newsroom/PRs/2023/2023-11-20_jobs-new-capital-investments/",
  "https://gov.nv.gov/Newsroom/PRs/2024/2024-06-25_new_international_investment_in_nevada/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "2024-05-23_governor-joe-lombardo-announce-over-270-new-jobs",
    [
      {
        key: "crossroads-paper",
        companyName: "Ingenia Chartam dba Crossroads Paper",
        facilityName: "Crossroads Paper Humboldt County Recycling Operation",
        city: null,
        countyName: "Humboldt County",
        amountUsd: 271_578_900,
        jobs: 108,
        techTags: ["recycling", "paper", "advanced_manufacturing", "materials"],
        sector: "advanced_manufacturing",
      },
      {
        key: "capital-usa-elko",
        companyName: "Capital USA",
        facilityName: "Capital USA Elko Geochemical Analysis and Mine Drilling Facility",
        city: "Elko",
        countyName: "Elko County",
        amountUsd: 14_975_322,
        jobs: 164,
        techTags: ["mining_services", "critical_minerals", "drilling", "industrial_services"],
        sector: "critical_minerals",
      },
    ],
  ],
  [
    "2024-01-25_newjobs",
    [
      {
        key: "aqua-metals-reno",
        companyName: "Aqua Metals Reno",
        facilityName: "Aqua Metals TRIC Battery Recycling Facility",
        city: "McCarran",
        countyName: "Storey County",
        amountUsd: 17_067_140,
        jobs: 39,
        techTags: ["battery", "recycling", "critical_minerals", "advanced_manufacturing"],
        sector: "battery",
      },
      {
        key: "edgewood-renewables",
        companyName: "Edgewood Renewables",
        facilityName: "Edgewood Renewables Clark County Biorefinery",
        city: null,
        countyName: "Clark County",
        amountUsd: 96_509_000,
        jobs: 60,
        techTags: ["biofuels", "sustainable_aviation_fuel", "clean_energy", "advanced_manufacturing"],
        sector: "clean_energy",
      },
      {
        key: "hard-eight-nutrition",
        companyName: "Hard Eight Nutrition",
        facilityName: "Hard Eight Nutrition Clark County Manufacturing Expansion",
        city: "Las Vegas",
        countyName: "Clark County",
        amountUsd: 7_141_000,
        jobs: 49,
        techTags: ["nutrition", "consumer_manufacturing", "advanced_manufacturing"],
        sector: "advanced_manufacturing",
      },
    ],
  ],
  [
    "2023-11-20_jobs-new-capital-investments",
    [
      {
        key: "agru-america",
        companyName: "Agru America",
        facilityName: "Agru America Fernley Manufacturing Expansion",
        city: "Fernley",
        countyName: "Lyon County",
        amountUsd: 20_872_500,
        jobs: 17,
        techTags: ["plastics", "advanced_manufacturing", "industrial_materials"],
        sector: "advanced_manufacturing",
      },
      {
        key: "alka-products",
        companyName: "Alka Products",
        facilityName: "Alka Products Pahrump PPE Manufacturing Facility",
        city: "Pahrump",
        countyName: "Nye County",
        amountUsd: 22_800_000,
        jobs: 240,
        techTags: ["medical_devices", "ppe", "advanced_manufacturing"],
        sector: "advanced_manufacturing",
      },
      {
        key: "bauderer-packaging",
        companyName: "Bauderer Packaging",
        facilityName: "Bauderer Packaging North Las Vegas Food Packaging Facility",
        city: "North Las Vegas",
        countyName: "Clark County",
        amountUsd: 13_025_000,
        jobs: 89,
        techTags: ["food_packaging", "consumer_manufacturing", "advanced_manufacturing"],
        sector: "advanced_manufacturing",
      },
      {
        key: "chameleon-beverage",
        companyName: "Chameleon Beverage Company",
        facilityName: "Chameleon Beverage Clark County Bottle Manufacturing Facility",
        city: null,
        countyName: "Clark County",
        amountUsd: 5_611_430,
        jobs: 20,
        techTags: ["beverage", "plastics", "advanced_manufacturing", "consumer_manufacturing"],
        sector: "advanced_manufacturing",
      },
      {
        key: "kraus-hamdani-aerospace",
        companyName: "Kraus Hamdani Aerospace",
        facilityName: "Kraus Hamdani Aerospace Reno Stead UAS Facility",
        city: "Reno",
        countyName: "Washoe County",
        amountUsd: 7_280_000,
        jobs: 5,
        techTags: ["aerospace", "uas", "defense", "advanced_manufacturing"],
        sector: "aerospace_defense",
      },
      {
        key: "warby-parker",
        companyName: "Warby Parker",
        facilityName: "Warby Parker Clark County Optical Lab Expansion",
        city: "Las Vegas",
        countyName: "Clark County",
        amountUsd: 1_326_344,
        jobs: 30,
        techTags: ["optics", "consumer_manufacturing", "advanced_manufacturing"],
        sector: "advanced_manufacturing",
      },
    ],
  ],
  [
    "2024-06-25_new_international_investment_in_nevada",
    [
      {
        key: "pcm-railone",
        companyName: "PCM RailOne AG",
        facilityName: "PCM RailOne North Las Vegas Rail Tie Manufacturing Unit",
        city: "North Las Vegas",
        countyName: "Clark County",
        amountUsd: 20_000_000,
        jobs: 50,
        techTags: ["rail", "transportation_infrastructure", "precast_concrete", "advanced_manufacturing"],
        sector: "transportation_infrastructure",
      },
    ],
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
  if (haystack.includes("battery")) tags.add("battery");
  if (haystack.includes("recycling")) tags.add("recycling");
  if (haystack.includes("drilling")) tags.add("drilling");
  if (haystack.includes("rail")) tags.add("transportation_infrastructure");
  return Array.from(tags);
}

async function loadNevadaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.NV&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`NV:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchNevadaGovernorProjectPage(url) {
  const userAgent =
    process.env.NEVADA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Nevada project fetch failed: ${response.status} ${url}`);
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
      "Nevada strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      html.match(/<newdate>([^<]+)<\/newdate>/i)?.[1]?.trim() ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestNevadaGovernorProjects() {
  const urls = readListEnv("NEVADA_PROJECT_URLS", DEFAULT_NEVADA_PROJECT_URLS);
  const countyMap = await loadNevadaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchNevadaGovernorProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Nevada Strategic Projects";

  for (const page of pages) {
    const overrides = ARTICLE_OVERRIDES.get(page.slug) || [];

    for (const override of overrides) {
      const geo = countyMap.get(`NV:${normalizeCountyName(override.countyName)}`) || null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "NV",
        countyName: geo?.county_name || override.countyName,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
      const sourceNaturalId = `${page.url}#${override.key}`;
      const companyId = deterministicUuid(`entity:nevada-projects:${normalizeName(override.companyName)}`);
      const facilityId = deterministicUuid(`facility:nevada-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:nevada-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:nevada-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:nevada-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:nevada-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:nevada-projects:${sourceNaturalId}`);
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
          state: "NV",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: geoId ? 88 : 76,
        metadata: {
          source: sourceName,
          facility_type: "industrial_project_site",
          location_label: override.city ? `${override.city}, NV` : `${override.countyName}, NV`,
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
        extraction_version: "nevada-governor-projects-v1",
      });

      bundle.projectRows.push({
        id: projectId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_type: "state_strategic_project",
        sector: override.sector || techTags[0] || "industrial",
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
        provider_name: "Nevada Governor's Office of Economic Development",
        recipient_name: override.companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "NV",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || override.countyName,
          label: override.city ? `${override.city}, NV` : `${override.countyName}, NV`,
        },
        recipient_location: {
          city: override.city,
          state: "NV",
        },
        jobs_estimate: override.jobs || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        capex_estimate: override.amountUsd,
        program_name: "Nevada Strategic Projects",
        confidence_score: geoId ? 86 : 76,
        provenance: {
          matchedEntityStrategy: "nevada_governor_override",
          matchedFacilityStrategy: geoId ? "nevada_county_match" : "nevada_state_or_city_only",
          notes: ["Official Nevada Governor / GOED economic development announcement parsed from article HTML."],
        },
      });

      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        dataset: "nevada_state_projects",
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
          state: "NV",
        },
      });

      bundle.facilityEventRows.push({
        id: deterministicUuid(`facility-event:nevada-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        signal_id: signalId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        metadata: {
          location_label: override.city ? `${override.city}, NV` : `${override.countyName}, NV`,
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:nevada-projects:${sourceNaturalId}`),
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
        rationale: "Resolved from official Nevada governor strategic project announcement.",
      });
    }
  }

  return bundle;
}
