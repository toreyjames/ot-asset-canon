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

const DEFAULT_PENNSYLVANIA_PROJECT_URLS = [
  "https://dced.pa.gov/newsroom/governor-shapiro-secures-historic-3-5-billion-investment-from-lilly-to-build-new-state-of-the-art-pharmaceutical-manufacturing-facility-in-lehigh-county-creating-850-new-jobs/",
  "https://dced.pa.gov/newsroom/governor-shapiro-secures-over-1-billion-investment-from-johnson-johnson-to-build-new-cancer-fighting-manufacturing-facility-in-montgomery-county-creating-more-than-500-new-jobs/",
  "https://dced.pa.gov/newsroom/governor-shapiro-secures-nearly-353-million-investment-from-eos-energy-to-relocate-headquarters-to-pittsburgh-and-expand-pa-based-battery-manufacturing-operations-in-allegheny-county-creating-735-ne/",
  "https://dced.pa.gov/newsroom/creating-jobs-in-mifflin-county-shapiro-administration-secures-142-2-million-investment-from-first-quality-to-expand-manufacturing-operations-create-91-new-jobs/",
  "https://dced.pa.gov/newsroom/creating-jobs-in-philadelphia-governor-shapiro-secures-195-million-investment-from-drinkpak-to-open-flagship-east-coast-manufacturing-facility-in-pennsylvania/",
  "https://dced.pa.gov/newsroom/creating-jobs-in-cumberland-county-governor-shapiro-secures-132-9-million-investment-from-schreiber-foods-strengthening-pennsylvanias-agriculture-and-manufacturing-industries/",
  "https://dced.pa.gov/newsroom/in-lancaster-county-governor-shapiro-secures-147-5-million-investment-from-eurofins-lancaster-laboratories-to-grow-life-sciences-industry-create-250-new-jobs/",
  "https://dced.pa.gov/newsroom/creating-jobs-in-lycoming-county-shapiro-administration-secures-8-million-investment-from-farm-plast-to-open-its-first-manufacturing-facility-in-pennsylvania/",
  "https://dced.pa.gov/newsroom/governor-shapiro-announces-20-million-investment-from-b-braun-to-expand-medical-device-manufacturing-in-the-lehigh-valley-creating-200-new-jobs/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "governor-shapiro-secures-historic-3-5-billion-investment-from-lilly-to-build-new-state-of-the-art-pharmaceutical-manufacturing-facility-in-lehigh-county-creating-850-new-jobs",
    {
      companyName: "Eli Lilly and Company",
      facilityName: "Eli Lilly Lehigh Valley Manufacturing Campus",
      city: "Lower Macungie Township",
      countyName: "Lehigh County",
      amountUsd: 3_500_000_000,
      jobs: 850,
      techTags: ["life_sciences", "pharmaceuticals", "biomanufacturing", "advanced_manufacturing"],
    },
  ],
  [
    "governor-shapiro-secures-over-1-billion-investment-from-johnson-johnson-to-build-new-cancer-fighting-manufacturing-facility-in-montgomery-county-creating-more-than-500-new-jobs",
    {
      companyName: "Johnson & Johnson",
      facilityName: "Johnson & Johnson Montgomery County Oncology Manufacturing Facility",
      city: "Spring House",
      countyName: "Montgomery County",
      amountUsd: 1_000_000_000,
      jobs: 500,
      techTags: ["life_sciences", "pharmaceuticals", "oncology", "biomanufacturing"],
    },
  ],
  [
    "governor-shapiro-secures-nearly-353-million-investment-from-eos-energy-to-relocate-headquarters-to-pittsburgh-and-expand-pa-based-battery-manufacturing-operations-in-allegheny-county-creating-735-ne",
    {
      companyName: "Eos Energy Enterprises",
      facilityName: "Eos Energy Pittsburgh Headquarters and Battery Manufacturing Expansion",
      city: "Pittsburgh",
      countyName: "Allegheny County",
      amountUsd: 353_000_000,
      jobs: 735,
      techTags: ["battery", "grid_infrastructure", "energy_storage", "advanced_manufacturing"],
    },
  ],
  [
    "creating-jobs-in-mifflin-county-shapiro-administration-secures-142-2-million-investment-from-first-quality-to-expand-manufacturing-operations-create-91-new-jobs",
    {
      companyName: "First Quality",
      facilityName: "First Quality Mifflin County Manufacturing Expansion",
      city: "Lewistown",
      countyName: "Mifflin County",
      amountUsd: 142_200_000,
      jobs: 91,
      techTags: ["consumer_manufacturing", "paper_products", "advanced_manufacturing"],
    },
  ],
  [
    "creating-jobs-in-philadelphia-governor-shapiro-secures-195-million-investment-from-drinkpak-to-open-flagship-east-coast-manufacturing-facility-in-pennsylvania",
    {
      companyName: "DrinkPAK",
      facilityName: "DrinkPAK Philadelphia East Coast Manufacturing Facility",
      city: "Philadelphia",
      countyName: "Philadelphia County",
      amountUsd: 195_000_000,
      jobs: 250,
      techTags: ["food", "packaging", "beverage", "advanced_manufacturing"],
    },
  ],
  [
    "creating-jobs-in-cumberland-county-governor-shapiro-secures-132-9-million-investment-from-schreiber-foods-strengthening-pennsylvanias-agriculture-and-manufacturing-industries",
    {
      companyName: "Schreiber Foods",
      facilityName: "Schreiber Foods Cumberland County Expansion",
      city: "Shippensburg",
      countyName: "Cumberland County",
      amountUsd: 132_900_000,
      jobs: 100,
      techTags: ["food", "agriculture", "cold_chain", "advanced_manufacturing"],
    },
  ],
  [
    "in-lancaster-county-governor-shapiro-secures-147-5-million-investment-from-eurofins-lancaster-laboratories-to-grow-life-sciences-industry-create-250-new-jobs",
    {
      companyName: "Eurofins Lancaster Laboratories",
      facilityName: "Eurofins Lancaster Laboratories Life Sciences Expansion",
      city: "Lancaster",
      countyName: "Lancaster County",
      amountUsd: 147_500_000,
      jobs: 250,
      techTags: ["life_sciences", "laboratory", "biotech"],
    },
  ],
  [
    "creating-jobs-in-lycoming-county-shapiro-administration-secures-8-million-investment-from-farm-plast-to-open-its-first-manufacturing-facility-in-pennsylvania",
    {
      companyName: "Farm Plast",
      facilityName: "Farm Plast Lycoming County Manufacturing Facility",
      city: "Williamsport",
      countyName: "Lycoming County",
      amountUsd: 8_000_000,
      jobs: 63,
      techTags: ["agriculture", "plastics", "advanced_manufacturing"],
    },
  ],
  [
    "governor-shapiro-announces-20-million-investment-from-b-braun-to-expand-medical-device-manufacturing-in-the-lehigh-valley-creating-200-new-jobs",
    {
      companyName: "B. Braun Medical Inc.",
      facilityName: "B. Braun Lehigh Valley Medical Device Manufacturing Expansion",
      city: "Bethlehem",
      countyName: "Lehigh County",
      amountUsd: 20_000_000,
      jobs: 200,
      techTags: ["medical_devices", "life_sciences", "advanced_manufacturing"],
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
  if (haystack.includes("battery")) tags.add("battery");
  if (haystack.includes("pharma") || haystack.includes("oncology")) tags.add("pharmaceuticals");
  if (haystack.includes("medical device")) tags.add("medical_devices");
  return Array.from(tags);
}

async function loadPennsylvaniaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.PA&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`PA:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchPennsylvaniaProjectPage(url) {
  const userAgent =
    process.env.PENNSYLVANIA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Pennsylvania project fetch failed: ${response.status} ${url}`);
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
      "Pennsylvania strategic project",
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

export async function ingestPennsylvaniaDcedProjects() {
  const urls = readListEnv("PENNSYLVANIA_PROJECT_URLS", DEFAULT_PENNSYLVANIA_PROJECT_URLS);
  const countyMap = await loadPennsylvaniaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchPennsylvaniaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Pennsylvania Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`PA:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "PA",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:pennsylvania-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:pennsylvania-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:pennsylvania-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:pennsylvania-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:pennsylvania-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:pennsylvania-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:pennsylvania-projects:${sourceNaturalId}`);
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
        state: "PA",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 88 : 77,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: `${override.city}, PA`,
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
          label: `${override.city}, PA`,
        },
      },
      extraction_version: "pennsylvania-dced-projects-v1",
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
      provider_name: "Pennsylvania Department of Community and Economic Development",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "PA",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: `${override.city}, PA`,
      },
      recipient_location: {
        city: override.city,
        state: "PA",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "PA DCED Strategic Projects",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "pennsylvania_dced_override",
        matchedFacilityStrategy: geoId ? "pennsylvania_county_match" : "pennsylvania_state_or_city_only",
        notes: ["Official Pennsylvania DCED newsroom project announcement parsed from article HTML."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "pennsylvania_state_projects",
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
        state: "PA",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:pennsylvania-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: `${override.city}, PA`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:pennsylvania-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official Pennsylvania DCED newsroom project announcement.",
    });
  }

  return bundle;
}
