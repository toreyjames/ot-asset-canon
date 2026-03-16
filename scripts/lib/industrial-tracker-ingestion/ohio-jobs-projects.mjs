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

const DEFAULT_OHIO_PROJECT_URLS = [
  "https://www.jobsohio.com/newsroom/news-press/amgen-announces-major-expansion-in-ohio",
  "https://www.jobsohio.com/newsroom/news-press/whirlpool-expands-us-manufacturing-presence-with-300-million-investment-in-ohio-operations",
  "https://www.jobsohio.com/newsroom/news-press/first-quality-doubles-down-on-northwest-ohio",
  "https://www.jobsohio.com/newsroom/news-press/abbott-will-build-a-new-536-million-manufacturing-facility-in-bowling-green-creating-450-new-jobs",
  "https://www.jobsohio.com/newsroom/news-press/intel-chooses-ohio-for-chip-manufacturing",
  "https://www.jobsohio.com/newsroom/news-press/microsoft-announces-first-phase-for-new-data-centers-in-the-columbus-region",
  "https://www.jobsohio.com/newsroom/news-press/pharmavite-maker-of-nature-made-vitamins-opens-250-million-production-facility-in-new-albany-ohio",
];

const CITY_TO_COUNTY = {
  "new albany": "Franklin County",
  clyde: "Sandusky County",
  marion: "Marion County",
  "bowling green": "Wood County",
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
  return parseAmountWithScale(
    firstMatch(text, [
      /\bmore than \$([\d.,]+)\s*(million|billion)\b/i,
      /\bworth more than \$([\d.,]+)\s*(million|billion)\b/i,
      /\bwill invest \$([\d.,]+)\s*(million|billion)\b/i,
      /\binvest(?:ing|s)? \$([\d.,]+)\s*(million|billion)\b/i,
      /\binvesting at least \$([\d.,]+)\s*(million|billion)\b/i,
      /\bplans to invest \$([\d.,]+)\s*(million|billion)\b/i,
      /\bcommitted to investing at least \$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\bopens? \$([\d.,]+)\s*(million|billion)\b/i,
      /\bnew \$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+(?:production|manufacturing|data center|campus|facility|facilities|plant|plants)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreating\s+([\d,]+)\s+jobs\b/i,
    /\bcreate(?: at least| up to)?\s+([\d,]+)\s+new jobs\b/i,
    /\bexpected to create(?: at least| up to)?\s+([\d,]+)\s+new jobs\b/i,
    /\bwhile creating\s+([\d,]+)\s+new jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description, text) {
  const haystack = `${title} ${description} ${text}`;
  const bodyMatch =
    firstMatch(haystack, [
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+has announced\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?),\s+JobsOhio\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+will invest\b/,
    ])?.[1] || null;
  if (bodyMatch) return bodyMatch.trim();

  const cleanedTitle = title.replace(/\s+\|\s+JobsOhio$/i, "").trim();
  return cleanedTitle;
}

function extractLocation(title, description, text) {
  const countyMatch =
    firstMatch(`${title} ${description} ${text}`, [
      /\b([A-Za-z .'-]+? County)\b/i,
    ]) || null;

  if (countyMatch?.[1]) {
    return {
      countyName: countyMatch[1].trim(),
      city: null,
      label: `${countyMatch[1].trim()}, OH`,
    };
  }

  const cityMatch =
    firstMatch(`${title} ${description} ${text}`, [
      /\bin\s+([A-Z][A-Za-z .'-]+),\s*Ohio\b/,
      /\boperations in\s+([A-Z][A-Za-z .'-]+)\b/,
      /\bsite in\s+([A-Z][A-Za-z .'-]+)\b/,
      /\bexpansion in\s+([A-Z][A-Za-z .'-]+)\b/,
    ]) || null;

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      city,
      label: `${city}, OH`,
    };
  }

  if (/clyde and marion/i.test(text)) {
    return {
      countyName: null,
      city: null,
      label: "Clyde + Marion, OH",
    };
  }

  return {
    countyName: null,
    city: null,
    label: "Ohio",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("biotech") || haystack.includes("biopharmaceutical")) tags.add("biomanufacturing");
  if (haystack.includes("advanced manufacturing")) tags.add("advanced_manufacturing");
  if (haystack.includes("defense")) tags.add("defense");
  if (haystack.includes("semiconductor")) tags.add("semiconductor");
  if (haystack.includes("home care") || haystack.includes("consumer products")) tags.add("consumer_manufacturing");
  return Array.from(tags);
}

async function loadOhioCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.OH&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`OH:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchOhioProjectPage(url) {
  const userAgent =
    process.env.OHIO_PROJECTS_USER_AGENT ||
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
      throw new Error(`Ohio project fetch failed: ${response.status} ${url}`);
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
    html,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "Ohio strategic project",
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

export async function ingestOhioJobsProjects() {
  const urls = readListEnv("OHIO_PROJECT_URLS", DEFAULT_OHIO_PROJECT_URLS);
  const countyMap = await loadOhioCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchOhioProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Ohio Strategic Projects";

  for (const page of pages) {
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text);
    const amount = extractAmountUsd(combinedText);
    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description, page.text);
    const geo =
      location.countyName
        ? countyMap.get(`OH:${normalizeCountyName(location.countyName)}`) || null
        : null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "OH",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const jobs = extractJobs(combinedText);
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:oh-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:oh-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:oh-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:oh-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:oh-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:oh-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:oh-projects:${sourceNaturalId}`);
    const techTags = buildTechTags(page.title, page.description, page.text);

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
      facility_name: page.title.replace(/\s+\|\s+JobsOhio$/i, "").trim(),
      normalized_name: normalizeName(page.title.replace(/\s+\|\s+JobsOhio$/i, "")),
      address: {
        city: location.city || undefined,
        state: "OH",
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
      extraction_version: "ohio-jobs-projects-v1",
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
      provider_name: "JobsOhio",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "OH",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "OH",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: amount,
      program_name: "JobsOhio",
      confidence_score: geoId ? 84 : 75,
      provenance: {
        matchedEntityStrategy: "jobsohio_announcement_company_parse",
        matchedFacilityStrategy: geoId ? "ohio_county_match" : "ohio_state_or_city_only",
        notes: ["Official JobsOhio strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "ohio_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 84,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        description: page.description,
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
        state: "OH",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:oh-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:oh-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official JobsOhio strategic project announcement.",
    });
  }

  return bundle;
}
