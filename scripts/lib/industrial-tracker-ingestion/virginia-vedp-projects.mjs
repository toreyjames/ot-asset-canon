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

const DEFAULT_VIRGINIA_PROJECT_URLS = [
  "https://www.vedp.org/press-release/2026-03/fukoku-korea-henry",
  "https://www.vedp.org/press-release/2026-03/interstate-group-giles",
  "https://www.vedp.org/press-release/2026-02/radian-forge-portsmouth",
  "https://www.vedp.org/press-release/2026-02/avio-hurt",
  "https://www.vedp.org/press-release/2026-02/grvty-tysons",
  "https://www.vedp.org/press-release/2026-02/umbra-fairfax",
];

const CITY_TO_COUNTY = {
  portsmouth: "Portsmouth city",
  tysons: "Fairfax County",
  hurt: "Pittsylvania County",
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
      /\$([\d.,]+)\+?\s*(million|billion)\s+investment\b/i,
      /\binvest(?:s|ing)?\s+\$([\d.,]+)\+?\s*(million|billion)\b/i,
      /\bwith\s+\$([\d.,]+)\+?\s*(million|billion)\s+investment\b/i,
      /\bworth\s+\$([\d.,]+)\+?\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\+?\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate more than\s+([\d,]+)\s+jobs\b/i,
    /\bcreate(?:s)?\s+([\d,]+)\s+new jobs\b/i,
    /\bwill create\s+([\d,]+)\s+jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description, text) {
  const haystack = `${title} ${description} ${text}`;
  const bodyMatch =
    firstMatch(haystack, [
      /\bSpace Technology Company\s+([A-Z][A-Za-z0-9&.,' -]+?)\s+/i,
      /\bDefense Technology Firm\s+([A-Z][A-Za-z0-9&.,' -]+?)\s+/i,
      /\bannounced that ([A-Z][A-Za-z0-9&.,' -]+?)(?:,|\s+will\b|\s+plans\b|\s+to\b)/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:expands|announces|selects|invests|to establish)\b/i,
    ])?.[1] || null;

  if (bodyMatch) return bodyMatch.trim();

  return title
    .replace(/\s+\|\s+Virginia Economic Development Partnership$/i, "")
    .replace(/\s+to Establish.*$/i, "")
    .replace(/\s+Announces.*$/i, "")
    .replace(/\s+Expands.*$/i, "")
    .replace(/\s+Selects.*$/i, "")
    .trim();
}

function extractLocation(title, description, text) {
  const countyMatch = firstMatch(`${title} ${description} ${text}`, [
    /\b([A-Za-z .'-]+? County)\b/i,
  ]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, VA`,
    };
  }

  const cityMatch = firstMatch(`${title} ${description} ${text}`, [
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*Virginia\b/,
    /\bin\s+([A-Z][A-Za-z .'-]+)\b/,
  ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, VA`,
    };
  }

  return {
    city: null,
    countyName: null,
    label: "Virginia",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("rocket") || haystack.includes("navy") || haystack.includes("defense")) {
    tags.add("defense");
  }
  if (haystack.includes("automotive")) tags.add("automotive");
  if (haystack.includes("forge") || haystack.includes("manufactur")) {
    tags.add("advanced_manufacturing");
  }
  if (haystack.includes("space")) tags.add("space");
  return Array.from(tags);
}

async function loadVirginiaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.VA&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`VA:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchVirginiaProjectPage(url) {
  const userAgent =
    process.env.VIRGINIA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Virginia project fetch failed: ${response.status} ${url}`);
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
      "Virginia strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      url.match(/\/(\d{4}-\d{2})\//)?.[1] ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestVirginiaVedpProjects() {
  const urls = readListEnv("VIRGINIA_PROJECT_URLS", DEFAULT_VIRGINIA_PROJECT_URLS);
  const countyMap = await loadVirginiaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchVirginiaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Virginia Strategic Projects";

  for (const page of pages) {
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text);
    const amount = extractAmountUsd(combinedText);

    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description, page.text);
    const geo =
      location.countyName
        ? countyMap.get(`VA:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "VA",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
    });

    const geoId = geoRow?.id || geo?.id || null;
    const sourceNaturalId = page.url;
    const entityId = deterministicUuid(`entity:virginia-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:virginia-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:virginia-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:virginia-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:virginia-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:virginia-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:virginia-projects:${sourceNaturalId}`);
    const techTags = buildTechTags(page.title, page.description, page.text);
    const observedAt = isoDate(page.publishedAt);
    const amountRounded = Math.round(amount);
    const jobs = extractJobs(combinedText);

    if (geoRow) bundle.geoRows.push(geoRow);
    bundle.entityRows.push({
      id: entityId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 83,
      metadata: {
        source: sourceName,
      },
    });
    bundle.facilityRows.push({
      id: facilityId,
      entity_id: entityId,
      geo_id: geoId,
      facility_name: page.title.replace(/\s+\|\s+Virginia Economic Development Partnership$/i, "").trim(),
      normalized_name: normalizeName(
        page.title.replace(/\s+\|\s+Virginia Economic Development Partnership$/i, "")
      ),
      address: {
        city: location.city || undefined,
        state: "VA",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geoRow.county_fips,
      cbsa_code: geoRow.cbsa_code,
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
      source_hash: sha256(page.text),
      fetched_at: new Date().toISOString(),
      effective_date: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        url: page.url,
        companyName,
        amountUsd: amountRounded,
        location,
        jobs,
      },
      extraction_version: "virginia-vedp-projects-v1",
    });
    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: entityId,
      geo_id: geoId,
      project_type: "state_strategic_project",
      sector: techTags[0] || "industrial",
      status: "announced",
      investment_amount: amountRounded,
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
      amount: String(amountRounded),
      amount_type: "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_entity_id: null,
      recipient_entity_id: entityId,
      facility_id: facilityId,
      provider_name: "Virginia Economic Development Partnership",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "VA",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "VA",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      jobs_estimate: jobs,
      capex_estimate: amountRounded,
      program_name: "Virginia Economic Development Partnership",
      confidence_score: geoId ? 84 : 75,
      provenance: {
        matchedEntityStrategy: "vedp_press_release_company_parse",
        matchedFacilityStrategy: geoId ? "virginia_county_match" : "virginia_state_or_city_only",
        notes: ["Official VEDP press release announcement parsed from public release."],
      },
    });
    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: entityId,
      geo_id: geoId,
      project_id: projectId,
      source_name: sourceName,
      dataset: "virginia_state_projects",
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 84,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        description: page.description,
        amountUsd: amountRounded,
        jobs,
      },
    });
    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: entityId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "state_incentive_recorded",
      value: String(amountRounded),
      unit: "USD",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        jobs,
        tech_tags: techTags,
        state: "VA",
      },
    });
    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:virginia-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });
    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:virginia-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: entityId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8400" : "0.7500",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        sectorAlignment: true,
        companyName,
        location: location.label,
        techTags,
      },
      candidate_set: [entityId, facilityId],
      chosen: true,
      rationale: "Resolved from official VEDP strategic project announcement.",
    });
  }

  return bundle;
}
