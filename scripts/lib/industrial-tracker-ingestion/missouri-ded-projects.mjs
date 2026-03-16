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

const DEFAULT_MISSOURI_PROJECT_URLS = [
  "https://ded.mo.gov/press-room/simcote-expand-sedalia-investing-more-17-million-and-creating-35-new-jobs",
  "https://ded.mo.gov/press-room/mars-petcare-expand-kansas-city-manufacturing-facility-investing-82-million-and-creating",
  "https://ded.mo.gov/press-room/envicor-enterprises-expand-sikeston-investing-14-million-and-creating-25-jobs",
  "https://ded.mo.gov/press-room/peerless-products-expand-nevada-investing-35-million-and-creating-111-jobs",
  "https://ded.mo.gov/press-room/hitachi-energy-expand-jefferson-city-investing-approximately-10-million-and-adding-75",
  "https://ded.mo.gov/press-room/nestle-professional-usa-expands-trenton-investing-75-million-and-creating-more-30-jobs",
  "https://ded.mo.gov/press-room/conagra-brands-expand-macon-investing-291-million-and-creating-26-new-jobs",
  "https://ded.mo.gov/press-room/damotech-expand-moberly-investing-more-24-million-and-creating-50-new-jobs",
  "https://ded.mo.gov/press-room/weg-expand-washington-investing-77-million-and-creating-50-new-jobs",
  "https://ded.mo.gov/press-room/lambda-establish-ai-factory-facility-kansas-city",
];

const CITY_TO_COUNTY = {
  sedalia: "Pettis County",
  "kansas city": "Jackson County",
  sikeston: "Scott County",
  nevada: "Vernon County",
  "jefferson city": "Cole County",
  trenton: "Grundy County",
  macon: "Macon County",
  moberly: "Randolph County",
  washington: "Franklin County",
};

const ARTICLE_OVERRIDES = new Map([
  ["simcote-expand-sedalia-investing-more-17-million-and-creating-35-new-jobs", { companyName: "Simcote", city: "Sedalia", countyName: "Pettis County", amountUsd: 17_000_000, jobs: 35, techTags: ["advanced_manufacturing", "materials"] }],
  ["mars-petcare-expand-kansas-city-manufacturing-facility-investing-82-million-and-creating", { companyName: "Mars Petcare", city: "Kansas City", countyName: "Jackson County", amountUsd: 82_000_000, jobs: 95, techTags: ["food_processing", "advanced_manufacturing", "consumer_manufacturing"] }],
  ["envicor-enterprises-expand-sikeston-investing-14-million-and-creating-25-jobs", { companyName: "Envicor Enterprises", city: "Sikeston", countyName: "Scott County", amountUsd: 14_000_000, jobs: 25, techTags: ["materials", "advanced_manufacturing"] }],
  ["peerless-products-expand-nevada-investing-35-million-and-creating-111-jobs", { companyName: "Peerless Products", city: "Nevada", countyName: "Vernon County", amountUsd: 35_000_000, jobs: 111, techTags: ["building_products", "advanced_manufacturing"] }],
  ["hitachi-energy-expand-jefferson-city-investing-approximately-10-million-and-adding-75", { companyName: "Hitachi Energy", city: "Jefferson City", countyName: "Cole County", amountUsd: 10_000_000, jobs: 75, techTags: ["grid", "power_equipment", "advanced_manufacturing"] }],
  ["nestle-professional-usa-expands-trenton-investing-75-million-and-creating-more-30-jobs", { companyName: "Nestle Professional USA", city: "Trenton", countyName: "Grundy County", amountUsd: 75_000_000, jobs: 30, techTags: ["food_processing", "advanced_manufacturing"] }],
  ["conagra-brands-expand-macon-investing-291-million-and-creating-26-new-jobs", { companyName: "Conagra Brands", city: "Macon", countyName: "Macon County", amountUsd: 29_100_000, jobs: 26, techTags: ["food_processing", "advanced_manufacturing"] }],
  ["damotech-expand-moberly-investing-more-24-million-and-creating-50-new-jobs", { companyName: "Damotech", city: "Moberly", countyName: "Randolph County", amountUsd: 24_000_000, jobs: 50, techTags: ["logistics_equipment", "advanced_manufacturing"] }],
  ["weg-expand-washington-investing-77-million-and-creating-50-new-jobs", { companyName: "WEG", city: "Washington", countyName: "Franklin County", amountUsd: 77_000_000, jobs: 50, techTags: ["power_equipment", "grid", "advanced_manufacturing"] }],
  ["lambda-establish-ai-factory-facility-kansas-city", { companyName: "Lambda", city: "Kansas City", countyName: "Jackson County", amountUsd: 150_000_000, techTags: ["ai", "data_center", "compute_infrastructure"] }],
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
      /\bmore than \$([\d.,]+)\s*(million|billion|m|b)\b/i,
      /\binvesting(?: approximately)? \$([\d.,]+)\s*(million|billion|m|b)\b/i,
      /\binvest(?:ing|s)? \$([\d.,]+)\s*(million|billion|m|b)\b/i,
      /\b\$([\d.,]+)\s*(million|billion|m|b)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion|m|b)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreating\s+([\d,]+)\s+new jobs\b/i,
    /\bcreating\s+([\d,]+)\s+jobs\b/i,
    /\badding\s+([\d,]+)\s+new jobs\b/i,
    /\badding\s+([\d,]+)\s+jobs\b/i,
    /\bmore than\s+([\d,]+)\s+jobs\b/i,
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
  const match = firstMatch(haystack, [
    /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:announced|to expand|expands|establishes|opens)\b/,
    /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:investing|creating|bringing)\b/,
  ])?.[1];
  return match?.trim() || title.replace(/\s+\|\s+Department of Economic Development$/i, "").trim();
}

function extractLocation(title, description, text, override) {
  if (override?.countyName || override?.city) {
    return {
      city: override?.city || null,
      countyName: override?.countyName || (override?.city ? CITY_TO_COUNTY[override.city.toLowerCase()] || null : null),
      label: `${override?.city || override?.countyName || "Missouri"}, MO`,
    };
  }
  const countyMatch = firstMatch(`${title} ${description} ${text}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) return { city: null, countyName: countyMatch[1].trim(), label: `${countyMatch[1].trim()}, MO` };
  const cityMatch = firstMatch(`${title} ${description} ${text}`, [
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*Missouri\b/i,
    /\bexpand\s+([A-Z][A-Za-z .'-]+)\b/i,
    /\bestablish(?:es)? .*? in\s+([A-Z][A-Za-z .'-]+)\b/i,
  ]);
  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return { city, countyName: CITY_TO_COUNTY[city.toLowerCase()] || null, label: `${city}, MO` };
  }
  return { city: null, countyName: null, label: "Missouri" };
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("ai factory") || haystack.includes("superintelligence")) tags.add("ai");
  if (haystack.includes("petcare") || haystack.includes("soybean") || haystack.includes("foods")) tags.add("food_processing");
  if (haystack.includes("energy")) tags.add("grid");
  if (haystack.includes("manufacturing")) tags.add("advanced_manufacturing");
  return Array.from(tags);
}

async function loadMissouriCountyMap() {
  const rows = (await supabaseFetch("geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.MO&limit=1000")) || [];
  return new Map(rows.filter((row) => row.county_name && row.county_fips).map((row) => [`MO:${normalizeCountyName(row.county_name)}`, row]));
}

async function fetchMissouriProjectPage(url) {
  const userAgent = process.env.MISSOURI_PROJECTS_USER_AGENT || process.env.SEC_USER_AGENT || "Baseload Industrial Tracker contact@aibaseload.com";
  let html;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok) throw new Error(`Missouri project fetch failed: ${response.status} ${url}`);
    html = await response.text();
  } catch (error) {
    const { stdout } = await execFileAsync("curl", ["-sL", "-A", userAgent, "-H", "Accept: text/html,application/xhtml+xml", url]);
    if (!stdout?.trim()) throw error;
    html = stdout;
  }

  return {
    url,
    slug: slugFromUrl(url),
    html,
    title: extractMetaContent(html, "og:title") || extractMetaContent(html, "twitter:title") || html.match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1]?.trim() || "Missouri strategic project",
    publishedAt: extractMetaContent(html, "article:published_time") || extractMetaContent(html, "og:published_time") || null,
    description: extractMetaContent(html, "description") || extractMetaContent(html, "og:description") || "",
    text: stripHtml(html),
  };
}

export async function ingestMissouriDedProjects() {
  const urls = readListEnv("MISSOURI_PROJECT_URLS", DEFAULT_MISSOURI_PROJECT_URLS);
  const countyMap = await loadMissouriCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchMissouriProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Missouri Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text, override);
    const amountUsd = override?.amountUsd || extractAmountUsd(combinedText);
    if (!companyName || amountUsd === null) continue;

    const location = extractLocation(page.title, page.description, page.text, override);
    const geo = location.countyName ? countyMap.get(`MO:${normalizeCountyName(location.countyName)}`) || null : null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "MO",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:missouri-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:missouri-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:missouri-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:missouri-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:missouri-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:missouri-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:missouri-projects:${sourceNaturalId}`);
    const jobs = override?.jobs ?? extractJobs(combinedText);
    const techTags = buildTechTags(page.title, page.description, page.text, override);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({ id: companyId, legal_name: companyName, normalized_name: normalizeName(companyName), entity_type: "company", country: "US", identifiers: {}, aliases: [], confidence_score: 85, metadata: { source: sourceName } });
    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: page.title.replace(/\s+\|\s+Department of Economic Development$/i, "").trim(),
      normalized_name: normalizeName(page.title.replace(/\s+\|\s+Department of Economic Development$/i, "")),
      address: { city: location.city || undefined, state: "MO", countyFips: geo?.county_fips || undefined },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 86 : 74,
      metadata: { source: sourceName, facility_type: "industrial_project_site", location_label: location.label, tech_tags: techTags },
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
      raw_payload: { title: page.title, description: page.description, companyName, amount: amountUsd, jobs: jobs || null, location },
      extraction_version: "missouri-ded-projects-v1",
    });
    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "state_strategic_project",
      sector: techTags[0] || "industrial",
      status: "announced",
      investment_amount: amountUsd,
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      metadata: { source: sourceName, jobs_estimate: jobs || null, source_url: page.url, description: page.description },
    });
    bundle.investmentRows.push({
      id: eventId,
      source_record_id: sourceRecordId,
      geo_id: geoId,
      taxonomy_id: null,
      event_type: "strategic_capital_commitment",
      amount: String(amountUsd),
      amount_type: "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_entity_id: null,
      recipient_entity_id: companyId,
      facility_id: facilityId,
      provider_name: "Missouri Department of Economic Development",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: { stateCode: "MO", countyFips: geo?.county_fips || null, countyName: geo?.county_name || location.countyName || null, label: location.label },
      recipient_location: { city: location.city || null, state: "MO" },
      jobs_estimate: jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: amountUsd,
      program_name: "Missouri Department of Economic Development",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "missouri_ded_override_or_parse",
        matchedFacilityStrategy: geoId ? "missouri_county_match" : "missouri_state_or_city_only",
        notes: ["Official Missouri Department of Economic Development strategic project announcement parsed from public release."],
      },
    });
    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "missouri_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 86,
      source_url: page.url,
      raw_payload: { title: page.title, amount: amountUsd, jobs: jobs || null },
    });
    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "state_incentive_recorded",
      value: String(amountUsd),
      unit: "USD",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: { jobs: jobs || null, tech_tags: techTags, state: "MO" },
    });
    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:missouri-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: { location_label: location.label },
    });
    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:missouri-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8600" : "0.7600",
      features: { exactIdentifiers: [], nameSimilarity: 1, sectorAlignment: true, companyName, location, techTags },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official Missouri Department of Economic Development strategic project announcement.",
    });
  }

  return bundle;
}
