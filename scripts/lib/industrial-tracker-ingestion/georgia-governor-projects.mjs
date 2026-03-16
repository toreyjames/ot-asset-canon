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

const DEFAULT_GEORGIA_PROJECT_URLS = [
  "https://gov.georgia.gov/press-releases/2026-03-03/gov-kemp-power-grid-technology-leader-breaks-ground-west-georgia",
  "https://gov.georgia.gov/press-releases/2025-11-12/gov-kemp-socomec-create-300-new-jobs-suwanee",
  "https://gov.georgia.gov/press-releases/2025-09-03/gov-kemp-korean-magnet-facility-create-more-500-jobs-columbus",
  "https://gov.georgia.gov/press-releases/2022-07-14/gov-kemp-anduril-industries-invest-60-million-create-180-new-jobs-fulton",
  "https://gov.georgia.gov/press-releases/2022-05-20/gov-kemp-hyundai-motor-group-invest-554-billion-georgia-first-fully",
];

const CITY_TO_COUNTY = {
  franklin: "Heard County",
  suwanee: "Gwinnett County",
  columbus: "Muscogee County",
  atlanta: "Fulton County",
  ellabell: "Bryan County",
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
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"]+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"]+)["']`, "i"),
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
      /\binvest(?:ing|s)? (?:an estimated |about |nearly |over |more than )?\$([\d.,]+)\s*(million|billion)\b/i,
      /\bintends to invest (?:an estimated |about |nearly |over |more than )?\$([\d.,]+)\s*(million|billion)\b/i,
      /\bplans to invest (?:an estimated |about |nearly |over |more than )?\$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate more than\s+([\d,]+)\s+new jobs\b/i,
    /\bcreating up to\s+([\d,]+)\s+new full-time jobs\b/i,
    /\bcreating\s+([\d,]+)\s+new jobs\b/i,
    /\bcreate\s+([\d,]+)\s+new jobs\b/i,
    /\bcreate(?:s)?\s+over\s+([\d,]+)\s+jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description, text) {
  const bodyMatch =
    firstMatch(`${description} ${text}`, [
      /\bannounced that ([A-Z][A-Za-z0-9&.,' -]+?)(?:,|\s+will\b|\s+intends\b|\s+plans\b)/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+will invest\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+intends to invest\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+plans to invest\b/i,
    ])?.[1] || null;
  if (bodyMatch) return bodyMatch.trim();

  return title.replace(/^Gov\. Kemp:\s*/i, "").trim();
}

function extractLocation(title, description, text) {
  const countyMatch = firstMatch(`${description} ${text}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, GA`,
    };
  }

  const cityMatch =
    firstMatch(`${title} ${description} ${text}`, [
      /\bin\s+([A-Z][A-Za-z .'-]+),\s*Georgia\b/,
      /\bin\s+([A-Z][A-Za-z .'-]+)\b/,
    ]) || null;

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, GA`,
    };
  }

  return {
    city: null,
    countyName: null,
    label: "Georgia",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("magnet")) tags.add("critical_minerals");
  if (haystack.includes("transformer") || haystack.includes("grid")) tags.add("grid_infrastructure");
  if (haystack.includes("battery") || haystack.includes("ev")) tags.add("battery");
  if (haystack.includes("semiconductor")) tags.add("semiconductor");
  if (haystack.includes("defense")) tags.add("defense");
  if (haystack.includes("manufacturing")) tags.add("advanced_manufacturing");
  return Array.from(tags);
}

async function loadGeorgiaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.GA&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`GA:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchGeorgiaProjectPage(url) {
  const userAgent =
    process.env.GEORGIA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Georgia project fetch failed: ${response.status} ${url}`);
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

  const dateFromUrl = url.match(/press-releases\/(\d{4}-\d{2}-\d{2})\//i)?.[1] || null;
  return {
    url,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "Georgia strategic project",
    publishedAt: dateFromUrl,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestGeorgiaGovernorProjects() {
  const urls = readListEnv("GEORGIA_PROJECT_URLS", DEFAULT_GEORGIA_PROJECT_URLS);
  const countyMap = await loadGeorgiaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchGeorgiaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Georgia Strategic Projects";

  for (const page of pages) {
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text);
    const amount = extractAmountUsd(combinedText);
    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description, page.text);
    const geo =
      location.countyName
        ? countyMap.get(`GA:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "GA",
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
    const companyId = deterministicUuid(`entity:ga-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:ga-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:ga-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:ga-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:ga-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:ga-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:ga-projects:${sourceNaturalId}`);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 86,
      metadata: {
        source: sourceName,
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: page.title.replace(/^Gov\. Kemp:\s*/i, "").trim(),
      normalized_name: normalizeName(page.title.replace(/^Gov\. Kemp:\s*/i, "")),
      address: {
        city: location.city || undefined,
        state: "GA",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 86 : 76,
      metadata: {
        source: sourceName,
        facility_type: techTags.includes("grid_infrastructure")
          ? "grid_infrastructure_site"
          : "industrial_project_site",
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
        amount,
        techTags,
      },
      extraction_version: "georgia-governor-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: techTags.includes("grid_infrastructure")
        ? "grid_infrastructure"
        : "industrial_expansion",
      investment_amount: amount,
      sector:
        techTags.includes("battery")
          ? "battery"
          : techTags.includes("semiconductor")
            ? "semiconductor"
            : techTags.includes("defense")
              ? "defense_manufacturing"
              : techTags.includes("grid_infrastructure")
                ? "energy"
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
      provider_name: "State of Georgia",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "GA",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "GA",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: String(amount),
      program_name: "Georgia Governor Economic Development Announcements",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "georgia_governor_announcement_company_parse",
        matchedFacilityStrategy: geoId ? "georgia_county_match" : "georgia_state_or_city_only",
        notes: ["Official Georgia governor press release parsed into canonical strategic project rows."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "georgia_governor_press_release",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 86,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        description: page.description,
        jobs,
        amount,
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
      value: String(amount),
      unit: "USD",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        jobs,
        tech_tags: techTags,
        state: "GA",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:ga-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:ga-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8600" : "0.7600",
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
      rationale: "Resolved from official Georgia governor strategic project announcement.",
    });
  }

  return bundle;
}
