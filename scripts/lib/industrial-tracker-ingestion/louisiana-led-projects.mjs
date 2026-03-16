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

const DEFAULT_LOUISIANA_PROJECT_URLS = [
  "https://www.opportunitylouisiana.gov/news/southern-energy-renewables-announce-1-4-billion-methanol-and-sustainable-aviation-fuel-facility-in-st-charles-parish/",
  "https://www.opportunitylouisiana.gov/news/shintech-louisiana-announces-3-4-billion-expansion-building-on-25-years-of-growth-and-commitment/",
  "https://www.opportunitylouisiana.gov/news/amazon-selects-louisiana-for-12-billion-data-center-campuses-in-major-u-s-expansion/",
  "https://www.opportunitylouisiana.gov/news/louisiana-earns-deal-of-the-year-award-for-historic-10-billion-meta-ai-data-center-project-in-northeast-louisiana/",
  "https://www.opportunitylouisiana.gov/news/another-louisiana-win-cf-industries-jera-and-mitsui-announce-4-billion-final-investment-decision-to-construct-worlds-largest-ammonia-facility-in-ascension-parish/",
  "https://www.opportunitylouisiana.gov/news/louisiana-wins-again-governor-jeff-landry-led-secure-5-8-billion-hyundai-steel-plant/",
];

const CITY_TO_COUNTY = {
  reserve: "St. Charles Parish",
  plaquemine: "Iberville Parish",
  donaldsonville: "Ascension Parish",
  shreveport: "Caddo Parish",
};

const ARTICLE_OVERRIDES = new Map([
  [
    "southern-energy-renewables-announce-1-4-billion-methanol-and-sustainable-aviation-fuel-facility-in-st-charles-parish",
    {
      companyName: "Southern Energy Renewables",
      city: "Reserve",
      countyName: "St. Charles Parish",
      amountUsd: 1_400_000_000,
      techTags: ["energy", "sustainable_fuel", "industrial_processing"],
    },
  ],
  [
    "shintech-louisiana-announces-3-4-billion-expansion-building-on-25-years-of-growth-and-commitment",
    {
      companyName: "Shintech Louisiana",
      city: "Plaquemine",
      countyName: "Iberville Parish",
      amountUsd: 3_400_000_000,
      techTags: ["chemicals", "petrochemical", "industrial_processing"],
    },
  ],
  [
    "amazon-selects-louisiana-for-12-billion-data-center-campuses-in-major-u-s-expansion",
    {
      companyName: "Amazon",
      city: "Shreveport",
      countyName: "Caddo Parish",
      amountUsd: 12_000_000_000,
      techTags: ["ai", "data_center", "grid_infrastructure"],
    },
  ],
  [
    "louisiana-earns-deal-of-the-year-award-for-historic-10-billion-meta-ai-data-center-project-in-northeast-louisiana",
    {
      companyName: "Meta",
      countyName: "Richland Parish",
      amountUsd: 10_000_000_000,
      techTags: ["ai", "data_center", "grid_infrastructure"],
    },
  ],
  [
    "another-louisiana-win-cf-industries-jera-and-mitsui-announce-4-billion-final-investment-decision-to-construct-worlds-largest-ammonia-facility-in-ascension-parish",
    {
      companyName: "CF Industries, JERA, and Mitsui",
      city: "Donaldsonville",
      countyName: "Ascension Parish",
      amountUsd: 4_000_000_000,
      techTags: ["energy", "industrial_processing", "chemicals"],
    },
  ],
  [
    "louisiana-wins-again-governor-jeff-landry-led-secure-5-8-billion-hyundai-steel-plant",
    {
      companyName: "Hyundai Steel",
      city: "Donaldsonville",
      countyName: "Ascension Parish",
      amountUsd: 5_800_000_000,
      jobs: 1300,
      techTags: ["steel", "advanced_manufacturing", "industrial_processing"],
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
      /\$([\d.,]+)\s*(million|billion)\s+(?:final investment decision|investment|expansion|plant|facility|project)/i,
      /\binvest(?:ing|ment)?\s+\$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\b([0-9,]+)\s+jobs\b/i,
    /\bcreate(?:s|d)?\s+([0-9,]+)\s+new jobs\b/i,
    /\bcreating\s+([0-9,]+)\s+jobs\b/i,
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
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:announces|announce|selects|chooses|wins|plans to)\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+(?:for major|for \$[\d.,]+)/i,
    ])?.[1] || null;

  if (bodyMatch) return bodyMatch.trim();
  return title.replace(/\s+-\s+LED \| Louisiana Economic Development$/i, "").trim();
}

function extractLocation(title, description, text, override) {
  if (override?.countyName || override?.city) {
    return {
      city: override?.city || null,
      countyName:
        override?.countyName ||
        (override?.city ? CITY_TO_COUNTY[override.city.toLowerCase()] || null : null),
      label: `${override?.city || override?.countyName || "Louisiana"}, LA`,
    };
  }

  const countyMatch = firstMatch(`${title} ${description} ${text}`, [/\b([A-Za-z .'-]+? Parish)\b/i]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, LA`,
    };
  }

  const cityMatch = firstMatch(`${title} ${description} ${text}`, [
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*Louisiana\b/,
    /\b([A-Z][A-Za-z .'-]+)\b,\s*La\./,
  ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    return {
      city,
      countyName: CITY_TO_COUNTY[city.toLowerCase()] || null,
      label: `${city}, LA`,
    };
  }

  return { city: null, countyName: null, label: "Louisiana" };
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("data center") || haystack.includes("ai")) tags.add("data_center");
  if (haystack.includes("amazon") || haystack.includes("meta")) tags.add("ai");
  if (haystack.includes("ammonia")) tags.add("industrial_processing");
  if (haystack.includes("steel")) tags.add("steel");
  if (haystack.includes("methanol") || haystack.includes("aviation fuel")) tags.add("sustainable_fuel");
  if (haystack.includes("shintech")) tags.add("petrochemical");
  return Array.from(tags);
}

async function loadLouisianaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.LA&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`LA:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchLouisianaProjectPage(url) {
  const userAgent =
    process.env.LOUISIANA_PROJECTS_USER_AGENT ||
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
      throw new Error(`Louisiana project fetch failed: ${response.status} ${url}`);
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
      "Louisiana strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      url.match(/\/(\d{4})\/(\d{2})\//)?.slice(1, 3).join("-") ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestLouisianaLedProjects() {
  const urls = readListEnv("LOUISIANA_PROJECT_URLS", DEFAULT_LOUISIANA_PROJECT_URLS);
  const countyMap = await loadLouisianaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchLouisianaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Louisiana Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text, override);
    const amount = override?.amountUsd ?? extractAmountUsd(combinedText);

    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description, page.text, override);
    const geo =
      location.countyName
        ? countyMap.get(`LA:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "LA",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });

    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const jobs = override?.jobs ?? extractJobs(combinedText);
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:louisiana-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:louisiana-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:louisiana-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:louisiana-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:louisiana-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:louisiana-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:louisiana-projects:${sourceNaturalId}`);
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
        state: "LA",
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
        amount,
        jobs,
        location,
      },
      extraction_version: "louisiana-led-projects-v1",
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
      provider_name: "Louisiana Economic Development",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "LA",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "LA",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: amount,
      program_name: "Louisiana Economic Development",
      confidence_score: geoId ? 86 : 76,
      provenance: {
        matchedEntityStrategy: "louisiana_led_company_parse",
        matchedFacilityStrategy: geoId ? "louisiana_parish_match" : "louisiana_state_or_city_only",
        notes: ["Official Louisiana Economic Development strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "louisiana_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 86,
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
        state: "LA",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:louisiana-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:louisiana-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official Louisiana Economic Development strategic project announcement.",
    });
  }

  return bundle;
}
