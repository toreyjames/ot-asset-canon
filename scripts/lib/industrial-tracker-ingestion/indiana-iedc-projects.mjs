import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  readListEnv,
  safeNumber,
  sha256,
  supabaseFetch,
  techTagsFromText,
} from "./common.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_INDIANA_PROJECT_URLS = [
  "https://iedc.in.gov/events/news/details/2026/02/27/newcold-plans-third-major-expansion-lebanon-indiana-growing-investment-to-800-million",
  "https://iedc.in.gov/events/news/details/2026/02/26/south-korea-based-manufacturer-picks-indiana-for-first-u.s.-operation-300-new-jobs",
  "https://iedc.in.gov/events/news/details/2026/02/26/taylormade-golf-plans-multi-million-dollar-expansion-in-southwest-indiana",
  "https://iedc.in.gov/events/news/details/2026/02/19/indiana-breaks-ground-on-new-munitions-campus-to-support-u.s.-defense-capabilities",
  "https://iedc.in.gov/events/news/details/2026/02/11/gov.-braun-breaks-ground-on-10b-meta-data-center-campus-at-leap-district",
  "https://iedc.in.gov/events/news/details/2026/02/24/gov.-braun-announces-health-tech-company-resmed-plans-indiana-distribution-center-joining-growing-life-sciences-sector",
];

const CITY_TO_COUNTY = {
  lebanon: "Boone County",
  huntington: "Huntington County",
  bloomfield: "Greene County",
  greenwood: "Johnson County",
  evansville: "Vanderburgh County",
};

const ARTICLE_OVERRIDES = new Map([
  [
    "newcold-plans-third-major-expansion-lebanon-indiana-growing-investment-to-800-million",
    {
      companyName: "NewCold",
      city: "Lebanon",
      countyName: "Boone County",
      techTags: ["cold_chain", "food_infrastructure", "logistics"],
    },
  ],
  [
    "south-korea-based-manufacturer-picks-indiana-for-first-u.s.-operation-300-new-jobs",
    {
      companyName: "Hanjung America",
      city: "Huntington",
      countyName: "Huntington County",
      techTags: ["battery", "energy_storage", "advanced_manufacturing"],
    },
  ],
  [
    "taylormade-golf-plans-multi-million-dollar-expansion-in-southwest-indiana",
    {
      companyName: "TaylorMade Golf",
      city: "Evansville",
      countyName: "Vanderburgh County",
      amountUsd: 5_000_000,
      techTags: ["advanced_manufacturing", "consumer_manufacturing"],
    },
  ],
  [
    "indiana-breaks-ground-on-new-munitions-campus-to-support-u.s.-defense-capabilities",
    {
      companyName: "Prometheus Energetics",
      city: "Bloomfield",
      countyName: "Greene County",
      techTags: ["defense", "munitions", "advanced_manufacturing"],
    },
  ],
  [
    "gov.-braun-breaks-ground-on-10b-meta-data-center-campus-at-leap-district",
    {
      companyName: "Meta",
      city: "Lebanon",
      countyName: "Boone County",
      amountUsd: 10_000_000_000,
      techTags: ["ai", "data_center", "grid_infrastructure"],
    },
  ],
  [
    "gov.-braun-announces-health-tech-company-resmed-plans-indiana-distribution-center-joining-growing-life-sciences-sector",
    {
      companyName: "Resmed",
      city: "Greenwood",
      countyName: "Johnson County",
      techTags: ["life_sciences", "medical_devices", "distribution"],
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

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function parseAmountWithScale(match) {
  if (!match) return null;
  const base = safeNumber(match[1]);
  if (base === null) return null;
  const scale = String(match[2] || "").toLowerCase();
  if (scale === "billion" || scale === "b") return base * 1_000_000_000;
  if (scale === "million" || scale === "m") return base * 1_000_000;
  return base;
}

function extractAmountUsd(text) {
  return parseAmountWithScale(
    firstMatch(text, [
      /\bmore than \$([\d.,]+)\+?\s*(b|m|million|billion)\b/i,
      /\b\$([\d.,]+)\+?\s*(b|m)\b/i,
      /\$([\d.,]+)\+?\s*(million|billion)\s+investment\b/i,
      /\bgrowing investment to \$([\d.,]+)\+?\s*(million|billion)\b/i,
      /\binvest(?:s|ing)?\s+\$([\d.,]+)\+?\s*(million|billion)\b/i,
      /\bplans .*?\$([\d.,]+)\+?\s*(million|billion)\b/i,
      /\bcommitted an investment .*? up to \$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\+?\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate more than\s+([\d,]+)\s+new jobs\b/i,
    /\bcreate(?:s)?\s+([\d,]+)\s+new jobs\b/i,
    /\bsupport\s+([\d,]+)\s+workers\b/i,
    /\bmore than\s+([\d,]+)\s+positions\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function slugFromUrl(url) {
  return String(url).split("/").filter(Boolean).pop() || url;
}

function extractCompanyName(title, description, text, override) {
  if (override?.companyName) return override.companyName;

  const haystack = `${title} ${description} ${text}`;
  const bodyMatch =
    firstMatch(haystack, [
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+plans\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+will\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?),\s+the leading\b/i,
      /\bhealth tech company\s+([A-Z][A-Za-z0-9&.,' -]+?)\s+/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+announced\b/i,
    ])?.[1] || null;

  if (bodyMatch) return bodyMatch.trim();
  return title.trim();
}

function extractLocation(title, description, text, override) {
  if (override?.countyName || override?.city) {
    return {
      city: override?.city || null,
      countyName: override?.countyName || (override?.city ? CITY_TO_COUNTY[override.city.toLowerCase()] || null : null),
      label: `${override?.city || override?.countyName || "Indiana"}, IN`,
    };
  }

  const countyMatch = firstMatch(`${title} ${description} ${text}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, IN`,
    };
  }

  const cityMatch = firstMatch(`${title} ${description} ${text}`, [
    /\b([A-Z][A-Za-z .'-]+),\s*Ind\.\b/,
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*Indiana\b/,
    /\bin\s+([A-Z][A-Za-z .'-]+)\b/,
  ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, IN`,
    };
  }

  return {
    city: null,
    countyName: null,
    label: "Indiana",
  };
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("data center")) tags.add("data_center");
  if (haystack.includes("meta")) tags.add("ai");
  if (haystack.includes("battery") || haystack.includes("energy storage")) tags.add("battery");
  if (haystack.includes("munitions") || haystack.includes("defense")) tags.add("defense");
  if (haystack.includes("distribution")) tags.add("distribution");
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  return Array.from(tags);
}

async function loadIndianaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.IN&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`IN:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchIndianaProjectPage(url) {
  const userAgent =
    process.env.INDIANA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Indiana project fetch failed: ${response.status} ${url}`);
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
      html.match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1]?.trim() ||
      "Indiana strategic project",
    publishedAt: url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//)?.slice(1, 4).join("-") || null,
    description: "",
    text: stripHtml(html),
  };
}

export async function ingestIndianaIedcProjects() {
  const urls = readListEnv("INDIANA_PROJECT_URLS", DEFAULT_INDIANA_PROJECT_URLS);
  const countyMap = await loadIndianaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchIndianaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Indiana Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text, override);
    const amount = override?.amountUsd ?? extractAmountUsd(combinedText);

    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description, page.text, override);
    const geo =
      location.countyName
        ? countyMap.get(`IN:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "IN",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });

    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const jobs = extractJobs(combinedText);
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:indiana-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:indiana-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:indiana-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:indiana-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:indiana-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:indiana-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:indiana-projects:${sourceNaturalId}`);
    const techTags = buildTechTags(page.title, page.description, page.text, override);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 83,
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
        state: "IN",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 84 : 74,
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
        companyName,
        amount,
        jobs,
        location,
      },
      extraction_version: "indiana-iedc-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "state_strategic_project",
      sector: techTags[0] || "industrial",
      status: "announced",
      investment_amount: amount,
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      metadata: {
        source: sourceName,
        jobs_estimate: jobs,
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
      amount: String(amount),
      amount_type: "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_entity_id: null,
      recipient_entity_id: companyId,
      facility_id: facilityId,
      provider_name: "Indiana Economic Development Corporation",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "IN",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "IN",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: amount,
      program_name: "Indiana Economic Development Corporation",
      confidence_score: geoId ? 84 : 75,
      provenance: {
        matchedEntityStrategy: "iedc_announcement_company_parse",
        matchedFacilityStrategy: geoId ? "indiana_county_match" : "indiana_state_or_city_only",
        notes: ["Official IEDC strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "indiana_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 84,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        amount,
        jobs,
      },
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "state_incentive_recorded",
      value: String(amount),
      unit: "USD",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        jobs,
        tech_tags: techTags,
        state: "IN",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:indiana-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:indiana-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8400" : "0.7500",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        sectorAlignment: true,
        companyName,
        location,
        techTags,
      },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official IEDC strategic project announcement.",
    });
  }

  return bundle;
}
