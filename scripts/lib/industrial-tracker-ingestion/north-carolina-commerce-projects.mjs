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

const DEFAULT_NORTH_CAROLINA_PROJECT_URLS = [
  "https://www.commerce.nc.gov/news/press-releases/2026/02/26/governor-stein-announces-us-based-steel-products-manufacturer-will-build-major-specialty-components",
  "https://www.commerce.nc.gov/news/press-releases/2026/01/09/governor-stein-announces-johnson-johnson-will-build-second-major-facility-wilson-county",
  "https://www.commerce.nc.gov/news/press-releases/2025/12/16/governor-stein-announces-40-million-expansion-hvac-supplier-greensboro",
  "https://www.commerce.nc.gov/news/press-releases/2025/12/17/furniture-company-coley-home-expand-claremont-9-million-investment",
];

const CITY_TO_COUNTY = {
  wilson: "Wilson County",
  greensboro: "Guilford County",
  claremont: "Catawba County",
};

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
  if (scale === "billion") return base * 1_000_000_000;
  if (scale === "million") return base * 1_000_000;
  return base;
}

function extractAmountUsd(text) {
  const explicit = parseAmountWithScale(
    firstMatch(text, [
      /\bplanned total investment of \$([\d.,]+)\s*(million|billion)\b/i,
      /\bwill invest \$([\d.,]+)\s*(million|billion)\b/i,
      /\bcompany will invest \$([\d.,]+)\s*(million|billion)\b/i,
      /\bwith \$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );

  if (explicit !== null) {
    return { amount: explicit, confidence: 86, note: null };
  }

  if (/\bmultibillion dollar investment\b/i.test(text)) {
    return {
      amount: 2_000_000_000,
      confidence: 60,
      note: "Lower-bound estimate derived from official 'multibillion dollar investment' language.",
    };
  }

  return { amount: null, confidence: 0, note: null };
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate(?: up to)?\s+([\d,]+)\s+new jobs\b/i,
    /\bcreate\s+([\d,]+)\s+new full-time jobs\b/i,
    /\bwill create\s+([\d,]+)\s+jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description) {
  const haystack = `${title} ${description}`;
  const bodyMatch =
    firstMatch(haystack, [
      /\bannounced ([A-Z][A-Za-z0-9&.,' -]+?),\s+(?:a|an|the)\b/i,
      /\bannounced ([A-Z][A-Za-z0-9&.,' -]+?) will\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+will create\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+will expand\b/i,
    ])?.[1] || null;

  if (bodyMatch) return bodyMatch.trim();

  return title.replace(/\s+\|\s+NC Commerce$/i, "").trim();
}

function extractLocation(title, description) {
  const countyMatch = firstMatch(`${title} ${description}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, NC`,
    };
  }

  const cityMatch = firstMatch(`${title} ${description}`, [
    /\bcity of\s+([A-Z][A-Za-z .'-]+)\b/i,
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*North Carolina\b/i,
    /\bin\s+([A-Z][A-Za-z .'-]+)\s+with\b/i,
  ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, NC`,
    };
  }

  return {
    city: null,
    countyName: null,
    label: "North Carolina",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("steel")) tags.add("advanced_manufacturing");
  if (haystack.includes("drug") || haystack.includes("oncology") || haystack.includes("neurological")) {
    tags.add("biomanufacturing");
  }
  if (haystack.includes("hvac")) tags.add("advanced_manufacturing");
  if (haystack.includes("furniture")) tags.add("consumer_manufacturing");
  if (haystack.includes("manufacturing")) tags.add("advanced_manufacturing");
  return Array.from(tags);
}

async function loadNorthCarolinaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.NC&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`NC:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchNorthCarolinaProjectPage(url) {
  const userAgent =
    process.env.NORTH_CAROLINA_PROJECTS_USER_AGENT ||
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
      throw new Error(`North Carolina project fetch failed: ${response.status} ${url}`);
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

    if (!stdout?.trim()) {
      throw error;
    }

    html = stdout;
  }

  return {
    url,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "North Carolina strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      url.match(/press-releases\/(\d{4}\/\d{2}\/\d{2})\//i)?.[1]?.replace(/\//g, "-") ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestNorthCarolinaCommerceProjects() {
  const urls = readListEnv("NORTH_CAROLINA_PROJECT_URLS", DEFAULT_NORTH_CAROLINA_PROJECT_URLS);
  const countyMap = await loadNorthCarolinaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchNorthCarolinaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "North Carolina Strategic Projects";

  for (const page of pages) {
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description);
    const amountInfo = extractAmountUsd(combinedText);
    if (!companyName || amountInfo.amount === null) continue;

    const location = extractLocation(page.title, page.description);
    const geo =
      location.countyName
        ? countyMap.get(`NC:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "NC",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const techTags = buildTechTags(page.title, page.description, page.text);
    const jobs = extractJobs(combinedText);
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:nc-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:nc-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:nc-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:nc-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:nc-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:nc-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:nc-projects:${sourceNaturalId}`);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: amountInfo.confidence,
      metadata: {
        source: sourceName,
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: page.title.trim(),
      normalized_name: normalizeName(page.title),
      address: {
        city: location.city || undefined,
        state: "NC",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? amountInfo.confidence : Math.max(70, amountInfo.confidence - 10),
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
      source_record_id: sourceNaturalId,
      source_category: "incentive",
      source_url: page.url,
      source_hash: sha256(page.text),
      fetched_at: new Date().toISOString(),
      effective_date: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        location,
        jobs,
        amount: amountInfo.amount,
        amount_note: amountInfo.note,
        techTags,
      },
      extraction_version: "north-carolina-commerce-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "industrial_expansion",
      investment_amount: amountInfo.amount,
      sector: techTags.includes("biomanufacturing")
        ? "biomanufacturing"
        : techTags.includes("consumer_manufacturing")
          ? "consumer_manufacturing"
          : "advanced_manufacturing",
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      status: "announced",
      metadata: {
        source: sourceName,
        jobs_estimate: jobs,
        source_url: page.url,
        description: page.description,
        amount_note: amountInfo.note,
      },
    });

    bundle.investmentRows.push({
      id: eventId,
      source_record_id: sourceRecordId,
      geo_id: geoId,
      taxonomy_id: null,
      event_type: "strategic_capital_commitment",
      amount: String(amountInfo.amount),
      amount_type: amountInfo.note ? "commitment_lower_bound" : "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_entity_id: null,
      recipient_entity_id: companyId,
      facility_id: facilityId,
      provider_name: "State of North Carolina",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "NC",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "NC",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: String(amountInfo.amount),
      program_name: "North Carolina Commerce Strategic Project Announcements",
      confidence_score: geoId ? amountInfo.confidence : Math.max(70, amountInfo.confidence - 10),
      provenance: {
        matchedEntityStrategy: "north_carolina_commerce_company_parse",
        matchedFacilityStrategy: geoId ? "north_carolina_county_match" : "north_carolina_state_or_city_only",
        notes: [
          "Official North Carolina Commerce press release parsed into canonical strategic project rows.",
          ...(amountInfo.note ? [amountInfo.note] : []),
        ],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "north_carolina_commerce_press_release",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: amountInfo.confidence,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        description: page.description,
        jobs,
        amount: amountInfo.amount,
        amount_note: amountInfo.note,
        techTags,
      },
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "state_incentive_recorded",
      value: String(amountInfo.amount),
      unit: "USD",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        jobs,
        tech_tags: techTags,
        state: "NC",
        amount_note: amountInfo.note,
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:nc-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:nc-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? `0.${amountInfo.confidence}00` : `0.${Math.max(70, amountInfo.confidence - 10)}00`,
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
      rationale: "Resolved from official North Carolina Commerce strategic project announcement.",
    });
  }

  return bundle;
}
