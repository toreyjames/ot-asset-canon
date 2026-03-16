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

const DEFAULT_ILLINOIS_PROJECT_URLS = [
  "https://www.illinoisedc.org/news/abbvie-to-invest-380m-in-north-chicago-campus-add-300-jobs/",
  "https://www.illinoisedc.org/news/pure-lithium-corporation-to-relocate-to-chicago-from-boston/",
  "https://www.illinoisedc.org/news/gov-pritzker-announces-infleqtion-to-accelerate-quantum-computing-in-illinois-and-locate-computing-headquarters-in-chicago/",
  "https://www.illinoisedc.org/news/quantummachinesiqmp/",
  "https://www.illinoisedc.org/news/gov-pritzker-announces-electric-bus-company-damera-to-open-first-u-s-assembly-plant-in-illinois/",
  "https://www.illinoisedc.org/news/governor-pritzker-and-rivian-announce-new-supplier-park-in-normal/",
  "https://www.illinoisedc.org/news/governor-pritzker-announces-25-million-investment-in-epic-medical/",
];

const CITY_TO_COUNTY = {
  chicago: "Cook County",
  "north chicago": "Lake County",
  normal: "McLean County",
  pekin: "Tazewell County",
  peoria: "Peoria County",
};

const ARTICLE_OVERRIDES = new Map([
  [
    "abbvie-to-invest-380m-in-north-chicago-campus-add-300-jobs",
    {
      companyName: "AbbVie",
      city: "North Chicago",
      countyName: "Lake County",
      amountUsd: 380_000_000,
      jobs: 300,
      techTags: ["advanced_manufacturing", "life_sciences", "pharmaceuticals"],
    },
  ],
  [
    "pure-lithium-corporation-to-relocate-to-chicago-from-boston",
    {
      companyName: "Pure Lithium Corporation",
      city: "Chicago",
      countyName: "Cook County",
      amountUsd: 46_000_000,
      techTags: ["battery", "critical_minerals", "advanced_manufacturing"],
    },
  ],
  [
    "gov-pritzker-announces-infleqtion-to-accelerate-quantum-computing-in-illinois-and-locate-computing-headquarters-in-chicago",
    {
      companyName: "Infleqtion",
      city: "Chicago",
      countyName: "Cook County",
      amountUsd: 50_000_000,
      techTags: ["quantum", "microelectronics", "advanced_computing"],
    },
  ],
  [
    "quantummachinesiqmp",
    {
      companyName: "Quantum Machines",
      city: "Chicago",
      countyName: "Cook County",
      amountUsd: 15_000_000,
      techTags: ["quantum", "advanced_computing", "microelectronics"],
    },
  ],
  [
    "gov-pritzker-announces-electric-bus-company-damera-to-open-first-u-s-assembly-plant-in-illinois",
    {
      companyName: "Damera Corporation",
      city: "Peoria",
      countyName: "Peoria County",
      amountUsd: 31_500_000,
      jobs: 90,
      techTags: ["mobility", "ev", "advanced_manufacturing"],
    },
  ],
  [
    "governor-pritzker-and-rivian-announce-new-supplier-park-in-normal",
    {
      companyName: "Rivian",
      city: "Normal",
      countyName: "McLean County",
      amountUsd: 120_000_000,
      jobs: 100,
      techTags: ["ev", "mobility", "advanced_manufacturing"],
    },
  ],
  [
    "governor-pritzker-announces-25-million-investment-in-epic-medical",
    {
      companyName: "Epic Medical",
      city: "Pekin",
      countyName: "Tazewell County",
      amountUsd: 25_000_000,
      jobs: 50,
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
      /\$([\d.,]+)\s*(million|billion|m|b)\b/i,
      /\binvest(?:ing|ment|s)?\s+\$([\d.,]+)\s*(million|billion|m|b)\b/i,
      /\bexpected \$([\d.,]+)\s*(million|billion|m|b)\s+investment\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreating\s+([\d,]+)\s+new (?:full-time )?jobs\b/i,
    /\bcreate(?:s|d)?\s+([\d,]+)\s+new (?:full-time )?jobs\b/i,
    /\b([\d,]+)\s+new jobs\b/i,
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
  const match =
    firstMatch(haystack, [
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:to invest|announces|will open|will locate|to relocate)\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:corporation)\b/,
    ])?.[1] || null;

  return match?.trim() || title.replace(/\s+-\s+Illinois Economic Development Corporation$/i, "").trim();
}

function extractLocation(title, description, text, override) {
  if (override?.countyName || override?.city) {
    return {
      city: override?.city || null,
      countyName:
        override?.countyName ||
        (override?.city ? CITY_TO_COUNTY[override.city.toLowerCase()] || null : null),
      label: `${override?.city || override?.countyName || "Illinois"}, IL`,
    };
  }

  const countyMatch = firstMatch(`${title} ${description} ${text}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) {
    return { city: null, countyName: countyMatch[1].trim(), label: `${countyMatch[1].trim()}, IL` };
  }

  const cityMatch = firstMatch(`${title} ${description} ${text}`, [
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*Illinois\b/,
    /\bof its\s+([A-Z][A-Za-z .'-]+)\s+campus\b/i,
  ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, IL`,
    };
  }

  return { city: null, countyName: null, label: "Illinois" };
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("quantum")) tags.add("quantum");
  if (haystack.includes("microelectronics")) tags.add("microelectronics");
  if (haystack.includes("battery")) tags.add("battery");
  if (haystack.includes("bus") || haystack.includes("supplier park")) tags.add("mobility");
  if (haystack.includes("pharmaceutical") || haystack.includes("medical")) tags.add("life_sciences");
  return Array.from(tags);
}

async function loadIllinoisCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.IL&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`IL:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchIllinoisProjectPage(url) {
  const userAgent =
    process.env.ILLINOIS_PROJECTS_USER_AGENT ||
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
      throw new Error(`Illinois project fetch failed: ${response.status} ${url}`);
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
      "Illinois strategic project",
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

export async function ingestIllinoisEdcProjects() {
  const urls = readListEnv("ILLINOIS_PROJECT_URLS", DEFAULT_ILLINOIS_PROJECT_URLS);
  const countyMap = await loadIllinoisCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchIllinoisProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Illinois Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    const companyName = extractCompanyName(page.title, page.description, page.text, override);
    const amountUsd = override?.amountUsd || extractAmountUsd(`${page.title} ${page.description} ${page.text}`);

    if (!companyName || !amountUsd) continue;

    const location = extractLocation(page.title, page.description, page.text, override);
    const geo =
      location.countyName
        ? countyMap.get(`IL:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "IL",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });

    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:illinois-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:illinois-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:illinois-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:illinois-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:illinois-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:illinois-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:illinois-projects:${sourceNaturalId}`);
    const jobs = override?.jobs ?? extractJobs(`${page.title} ${page.description} ${page.text}`);
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
      confidence_score: 85,
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
        state: "IL",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 86 : 74,
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
        amount: amountUsd,
        jobs: jobs || null,
        location,
      },
      extraction_version: "illinois-edc-projects-v1",
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
      metadata: {
        source: sourceName,
        jobs_estimate: jobs || null,
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
      provider_name: "Illinois Economic Development Corporation",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "IL",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "IL",
      },
      jobs_estimate: jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: amountUsd,
      program_name: "Illinois Economic Development Corporation",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "illinois_edc_override_or_parse",
        matchedFacilityStrategy: geoId ? "illinois_county_match" : "illinois_state_or_city_only",
        notes: ["Official Illinois Economic Development Corporation strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "illinois_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 86,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        amount: amountUsd,
        jobs: jobs || null,
      },
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
      metadata: {
        jobs: jobs || null,
        tech_tags: techTags,
        state: "IL",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:illinois-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:illinois-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official Illinois Economic Development Corporation strategic project announcement.",
    });
  }

  return bundle;
}
