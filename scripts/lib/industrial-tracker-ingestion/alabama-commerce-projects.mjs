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

const DEFAULT_ALABAMA_PROJECT_URLS = [
  "https://www.madeinalabama.com/2026/03/auto-supplier-plans-to-spend-430-million-create-more-than-1300-jobs-at-former-gadsden-steel-mill-site/",
  "https://www.madeinalabama.com/2026/03/shinhwa-expands-auburn-operation-with-37-million-investment-in-advanced-tooling-capabilities/",
  "https://www.madeinalabama.com/2026/02/faith-technologies-to-invest-79-million-in-opelika-manufacturing-expansion/",
  "https://www.madeinalabama.com/2025/12/pharmaceutical-giant-lilly-plans-6-billion-advanced-manufacturing-plant-in-huntsville/",
  "https://www.madeinalabama.com/2025/09/georgia-pacific-to-invest-800-million-in-alabama-river-cellulose-mill/",
  "https://www.madeinalabama.com/2025/12/bad-boy-mowers-plans-10-5-million-tractor-plant-in-monroeville/",
  "https://www.madeinalabama.com/2025/11/wire-manufacturer-plans-176-million-expansion-in-cleburne-county/",
  "https://www.madeinalabama.com/2025/05/nelson-brothers-picks-alabama-over-other-sites-for-19-4-million-expansion/",
];

const CITY_TO_COUNTY = {
  gadsden: "Etowah County",
  auburn: "Lee County",
  opelika: "Lee County",
  huntsville: "Madison County",
  monroeville: "Monroe County",
  "perdue hill": "Monroe County",
};

const ARTICLE_OVERRIDES = new Map([
  [
    "auto-supplier-plans-to-spend-430-million-create-more-than-1300-jobs-at-former-gadsden-steel-mill-site",
    {
      companyName: "Minth Group",
      city: "Gadsden",
      countyName: "Etowah County",
      amountUsd: 430_000_000,
      techTags: ["automotive", "advanced_manufacturing", "mobility"],
    },
  ],
  [
    "shinhwa-expands-auburn-operation-with-37-million-investment-in-advanced-tooling-capabilities",
    {
      companyName: "Shinhwa Auto USA",
      city: "Auburn",
      countyName: "Lee County",
      amountUsd: 37_000_000,
      techTags: ["automotive", "advanced_manufacturing", "tooling"],
    },
  ],
  [
    "faith-technologies-to-invest-79-million-in-opelika-manufacturing-expansion",
    {
      companyName: "Faith Technologies",
      city: "Opelika",
      countyName: "Lee County",
      amountUsd: 79_000_000,
      techTags: ["advanced_manufacturing", "electrification", "grid_infrastructure"],
    },
  ],
  [
    "pharmaceutical-giant-lilly-plans-6-billion-advanced-manufacturing-plant-in-huntsville",
    {
      companyName: "Eli Lilly and Company",
      city: "Huntsville",
      countyName: "Madison County",
      amountUsd: 6_000_000_000,
      techTags: ["life_sciences", "biomanufacturing", "advanced_manufacturing"],
    },
  ],
  [
    "georgia-pacific-to-invest-800-million-in-alabama-river-cellulose-mill",
    {
      companyName: "Georgia-Pacific",
      city: "Perdue Hill",
      countyName: "Monroe County",
      amountUsd: 800_000_000,
      techTags: ["forestry_products", "pulp", "industrial_processing"],
    },
  ],
  [
    "bad-boy-mowers-plans-10-5-million-tractor-plant-in-monroeville",
    {
      companyName: "Bad Boy Mowers",
      city: "Monroeville",
      countyName: "Monroe County",
      amountUsd: 10_500_000,
      techTags: ["advanced_manufacturing", "mobility", "consumer_manufacturing"],
    },
  ],
  [
    "wire-manufacturer-plans-176-million-expansion-in-cleburne-county",
    {
      companyName: "Southwire",
      countyName: "Cleburne County",
      amountUsd: 176_000_000,
      techTags: ["grid_infrastructure", "electrification", "advanced_manufacturing"],
    },
  ],
  [
    "nelson-brothers-picks-alabama-over-other-sites-for-19-4-million-expansion",
    {
      companyName: "Nelson Brothers",
      countyName: "Walker County",
      amountUsd: 19_400_000,
      techTags: ["chemicals", "industrial_processing", "defense"],
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
      /\bplans to spend \$([\d.,]+)\s*(million|billion)\b/i,
      /\bplans to invest \$([\d.,]+)\s*(million|billion)\b/i,
      /\binvest \$([\d.,]+)\s*(million|billion)\b/i,
      /\binvestment of \$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate more than\s+([\d,]+)\s+jobs\b/i,
    /\bcreate more than\s+([\d,]+)\s+new jobs\b/i,
    /\bcreating\s+([\d,]+)\s+jobs\b/i,
    /\bcreate(?:s)?\s+([\d,]+)\s+new jobs\b/i,
    /\badd\s+([\d,]+)\s+jobs\b/i,
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

  const bodyMatch =
    firstMatch(`${title} ${description} ${text}`, [
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+plans to\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+announced\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?),\s+selected its home state\b/i,
    ])?.[1] || null;

  if (bodyMatch) return bodyMatch.trim();
  return title.replace(/\s+-\s+Made in Alabama$/i, "").trim();
}

function extractLocation(title, description, text, override) {
  if (override?.countyName || override?.city) {
    return {
      city: override?.city || null,
      countyName:
        override?.countyName ||
        (override?.city ? CITY_TO_COUNTY[override.city.toLowerCase()] || null : null),
      label: `${override?.city || override?.countyName || "Alabama"}, AL`,
    };
  }

  const countyMatch = firstMatch(`${title} ${description} ${text}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, AL`,
    };
  }

  const cityMatch = firstMatch(`${title} ${description} ${text}`, [
    /\b([A-Z][A-Za-z .'-]+),\s*Alabama\b/,
    /\bin\s+([A-Z][A-Za-z .'-]+)\b/,
  ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, AL`,
    };
  }

  return { city: null, countyName: null, label: "Alabama" };
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("automotive")) tags.add("automotive");
  if (haystack.includes("wire") || haystack.includes("grid")) tags.add("grid_infrastructure");
  if (haystack.includes("pharmaceutical") || haystack.includes("manufacturing plant")) tags.add("life_sciences");
  if (haystack.includes("pulp") || haystack.includes("cellulose")) tags.add("forestry_products");
  if (haystack.includes("tractor")) tags.add("mobility");
  return Array.from(tags);
}

async function loadAlabamaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.AL&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`AL:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchAlabamaProjectPage(url) {
  const userAgent =
    process.env.ALABAMA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Alabama project fetch failed: ${response.status} ${url}`);
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
      "Alabama strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      url.match(/\/(\d{4})\/(\d{2})\//)?.slice(1, 3).join("-") ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestAlabamaCommerceProjects() {
  const urls = readListEnv("ALABAMA_PROJECT_URLS", DEFAULT_ALABAMA_PROJECT_URLS);
  const countyMap = await loadAlabamaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchAlabamaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Alabama Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text, override);
    const amount = override?.amountUsd ?? extractAmountUsd(combinedText);

    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description, page.text, override);
    const geo =
      location.countyName
        ? countyMap.get(`AL:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "AL",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });

    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const jobs = extractJobs(combinedText);
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:alabama-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:alabama-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:alabama-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:alabama-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:alabama-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:alabama-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:alabama-projects:${sourceNaturalId}`);
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
      confidence_score: 84,
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
        state: "AL",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 85 : 74,
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
      extraction_version: "alabama-commerce-projects-v1",
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
      provider_name: "Alabama Department of Commerce",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "AL",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "AL",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: amount,
      program_name: "Alabama Department of Commerce",
      confidence_score: geoId ? 85 : 75,
      provenance: {
        matchedEntityStrategy: "alabama_commerce_company_parse",
        matchedFacilityStrategy: geoId ? "alabama_county_match" : "alabama_state_or_city_only",
        notes: ["Official Made in Alabama strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "alabama_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 85,
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
        state: "AL",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:alabama-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:alabama-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8500" : "0.7500",
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
      rationale: "Resolved from official Alabama strategic project announcement.",
    });
  }

  return bundle;
}
