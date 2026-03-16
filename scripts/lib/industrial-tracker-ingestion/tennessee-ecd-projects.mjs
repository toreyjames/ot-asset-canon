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

const DEFAULT_TENNESSEE_PROJECT_URLS = [
  "https://tnecd.com/news/centrus-to-expand-oak-ridge-centrifuge-manufacturing-plant-to-facilitate-large-scale-deployment/",
  "https://tnecd.com/news/create-energy-acquires-338000-square-foot-facility-expansion-to-create-1000-new-jobs/",
  "https://tnecd.com/news/recticel-group-selects-tennessee-for-first-u-s-insulated-panels-facility/",
  "https://tnecd.com/news/lis-technologies-to-invest-more-than-1-billion-in-laser-uranium-enrichment-facility/",
];

const CITY_TO_COUNTY = {
  "mt. pleasant": "Maury County",
  "mt pleasant": "Maury County",
  "oak ridge": null,
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
      /\binvesting more than \$([\d.,]+)\s*(million|billion)\b/i,
      /\binvest more than \$([\d.,]+)\s*(million|billion)\b/i,
      /\bto invest more than \$([\d.,]+)\s*(million|billion)\b/i,
      /\binvest(?:ing|s)? \$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate(?:s)?\s+a total of\s+([\d,]+)\s+new jobs\b/i,
    /\bcreating a total of\s+([\d,]+)\s+new jobs\b/i,
    /\bcreate(?:s)?\s+([\d,]+)\s+new jobs\b/i,
    /\bcreating\s+([\d,]+)\s+new jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description) {
  const cleanedTitle = title
    .replace(/\s+-\s+News\s+-\s+Tennessee Department of Economic and Community Development$/i, "")
    .trim();

  const titleMatch = firstMatch(cleanedTitle, [
    /^(.+?)\s+(?:acquires|selects)\b/i,
    /^(.+?)\s+to\s+(?:expand|invest|relocate|create)\b/i,
  ])?.[1];

  if (titleMatch) return titleMatch.trim();

  const haystack = `${title} ${description}`;
  const bodyMatch =
    firstMatch(haystack, [
      /\bannounced today that ([A-Z][A-Za-z0-9&.,' -]+?)\s+\(/i,
      /\bofficials announced today (?:that )?([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:plans|will|is)\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+officials announced recently\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+to invest\b/i,
    ])?.[1] || null;

  if (bodyMatch && !/^the company$/i.test(bodyMatch.trim())) return bodyMatch.trim();

  return cleanedTitle;
}

function extractLocation(title, description) {
  const countyMatch = firstMatch(`${title} ${description}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, TN`,
    };
  }

  const cityMatch = firstMatch(`${title} ${description}`, [
    /\bselected\s+([A-Z][A-Za-z .'-]+),\s*Tennessee\b/i,
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*Tennessee\b/i,
    /\bits\s+([A-Z][A-Za-z .'-]+)\s+facility\b/i,
  ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, TN`,
    };
  }

  if (/sumner and robertson counties/i.test(description)) {
    return {
      city: null,
      countyName: null,
      label: "Sumner + Robertson Counties, TN",
    };
  }

  return {
    city: null,
    countyName: null,
    label: "Tennessee",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("uranium") || haystack.includes("centrifuge") || haystack.includes("enrichment")) {
    tags.add("nuclear");
  }
  if (haystack.includes("manufacturing")) tags.add("advanced_manufacturing");
  if (haystack.includes("panels")) tags.add("building_materials");
  if (haystack.includes("energy")) tags.add("energy");
  return Array.from(tags);
}

async function loadTennesseeCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.TN&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`TN:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchTennesseeProjectPage(url) {
  const userAgent =
    process.env.TENNESSEE_PROJECTS_USER_AGENT ||
    process.env.SEC_USER_AGENT ||
    "Baseload Industrial Tracker contact@aibaseload.com";

  let html;
  try {
    const { stdout } = await execFileAsync("curl", [
      "-sL",
      "-A",
      userAgent,
      "-H",
      "Accept: text/html,application/xhtml+xml",
      url,
    ]);

    if (!stdout?.trim()) {
      throw new Error(`Tennessee project curl returned empty body: ${url}`);
    }

    html = stdout;
  } catch (_curlError) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Tennessee project fetch failed: ${response.status} ${url}`);
    }

    html = await response.text();
  }

  return {
    url,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "Tennessee strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      null,
    description:
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestTennesseeEcdProjects() {
  const urls = readListEnv("TENNESSEE_PROJECT_URLS", DEFAULT_TENNESSEE_PROJECT_URLS);
  const countyMap = await loadTennesseeCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchTennesseeProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Tennessee Strategic Projects";

  for (const page of pages) {
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description);
    const amount = extractAmountUsd(combinedText);
    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description);
    const geo =
      location.countyName
        ? countyMap.get(`TN:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "TN",
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
    const companyId = deterministicUuid(`entity:tn-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:tn-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:tn-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:tn-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:tn-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:tn-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:tn-projects:${sourceNaturalId}`);

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
      facility_name: page.title.replace(/\s+-\s+News\s+-\s+Tennessee Department of Economic and Community Development$/i, "").trim(),
      normalized_name: normalizeName(page.title),
      address: {
        city: location.city || undefined,
        state: "TN",
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
      extraction_version: "tennessee-ecd-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: techTags.includes("nuclear") ? "strategic_energy" : "industrial_expansion",
      investment_amount: amount,
      sector: techTags.includes("nuclear")
        ? "nuclear"
        : techTags.includes("building_materials")
          ? "building_materials"
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
      provider_name: "State of Tennessee",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "TN",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "TN",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: String(amount),
      program_name: "Tennessee ECD Strategic Project Announcements",
      confidence_score: geoId ? 84 : 74,
      provenance: {
        matchedEntityStrategy: "tennessee_ecd_company_parse",
        matchedFacilityStrategy: geoId ? "tennessee_county_match" : "tennessee_state_or_city_only",
        notes: ["Official Tennessee ECD announcement parsed into canonical strategic project rows."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "tennessee_ecd_press_release",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 84,
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
        state: "TN",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:tn-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:tn-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8400" : "0.7400",
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
      rationale: "Resolved from official Tennessee ECD strategic project announcement.",
    });
  }

  return bundle;
}
