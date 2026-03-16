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

const DEFAULT_SOUTH_CAROLINA_PROJECT_URLS = [
  "https://www.sccommerce.com/news/cyclic-materials-selects-chesterfield-county-first-east-coast-operation",
  "https://www.sccommerce.com/news/coastal-precast-systems-selects-laurens-county-first-south-carolina-operation",
  "https://www.sccommerce.com/news/fenner-precision-polymers-selects-cherokee-county-new-south-carolina-operation",
  "https://www.sccommerce.com/news/sodecia-aapico-joint-venture-selects-orangeburg-county-establish-its-first-south-carolina",
  "https://www.sccommerce.com/news/georg-utz-inc-selects-sumter-county-first-south-carolina-operation",
  "https://www.sccommerce.com/news/huwell-us-inc-selects-cherokee-county-first-us-operation",
  "https://www.sccommerce.com/news/cheney-brothers-expands-florence-county-operations",
];

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
      /\bover \$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\bapproximately \$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\badditional \$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\bcompany(?:’s|'s)? \$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate(?: up to| about)?\s+([\d,]+)\s+new jobs\b/i,
    /\bwill create(?: up to| about)?\s+([\d,]+)\s+new jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description, text) {
  const cleanedTitle = title
    .replace(/\s+\|\s+South Carolina Department of Commerce$/i, "")
    .trim();

  const titleMatch = firstMatch(cleanedTitle, [
    /^(.+?)\s+(?:selects|expands|relocating|establishes)\b/i,
  ])?.[1];

  if (titleMatch) return titleMatch.trim();

  const haystack = `${description} ${text}`;
  const bodyMatch =
    firstMatch(haystack, [
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+\((?:[A-Z][A-Za-z0-9&.,' -]+)\),/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?),\s+(?:a|an|the)\b/i,
    ])?.[1] || null;

  if (bodyMatch) return bodyMatch.trim();

  return cleanedTitle;
}

function extractLocation(title, description) {
  const countyMatch = firstMatch(`${title} ${description}`, [/\b([A-Za-z .'-]+? County)\b/i]);
  if (countyMatch?.[1]) {
    return {
      city: null,
      countyName: countyMatch[1].trim(),
      label: `${countyMatch[1].trim()}, SC`,
    };
  }

  return {
    city: null,
    countyName: null,
    label: "South Carolina",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("rare earth")) tags.add("critical_minerals");
  if (haystack.includes("chemical")) tags.add("petrochemical");
  if (haystack.includes("concrete") || haystack.includes("precast")) tags.add("building_materials");
  if (haystack.includes("polymer")) tags.add("advanced_materials");
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("scout motors")) tags.add("automotive");
  return Array.from(tags);
}

async function loadSouthCarolinaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.SC&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`SC:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchSouthCarolinaProjectPage(url) {
  const userAgent =
    process.env.SOUTH_CAROLINA_PROJECTS_USER_AGENT ||
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
      throw new Error(`South Carolina project curl returned empty body: ${url}`);
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
      throw new Error(`South Carolina project fetch failed: ${response.status} ${url}`);
    }

    html = await response.text();
  }

  return {
    url,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "South Carolina strategic project",
    publishedAt:
      html.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] ||
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

export async function ingestSouthCarolinaCommerceProjects() {
  const urls = readListEnv("SOUTH_CAROLINA_PROJECT_URLS", DEFAULT_SOUTH_CAROLINA_PROJECT_URLS);
  const countyMap = await loadSouthCarolinaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchSouthCarolinaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "South Carolina Strategic Projects";

  for (const page of pages) {
    const combinedText = `${page.title} ${page.description} ${page.text}`;
    const companyName = extractCompanyName(page.title, page.description, page.text);
    const amount = extractAmountUsd(combinedText);
    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.description);
    const geo =
      location.countyName
        ? countyMap.get(`SC:${normalizeCountyName(location.countyName)}`) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "SC",
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
    const companyId = deterministicUuid(`entity:sc-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:sc-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:sc-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:sc-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:sc-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:sc-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:sc-projects:${sourceNaturalId}`);

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
      facility_name: page.title.replace(/\s+\|\s+South Carolina Department of Commerce$/i, "").trim(),
      normalized_name: normalizeName(page.title),
      address: {
        state: "SC",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 85 : 75,
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
      extraction_version: "south-carolina-commerce-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "industrial_expansion",
      investment_amount: amount,
      sector:
        techTags.includes("critical_minerals")
          ? "critical_minerals"
          : techTags.includes("petrochemical")
            ? "petrochemical"
            : techTags.includes("automotive")
              ? "automotive_supply"
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
      provider_name: "State of South Carolina",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "SC",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        state: "SC",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: String(amount),
      program_name: "South Carolina Commerce Strategic Project Announcements",
      confidence_score: geoId ? 85 : 75,
      provenance: {
        matchedEntityStrategy: "south_carolina_commerce_company_parse",
        matchedFacilityStrategy: geoId ? "south_carolina_county_match" : "south_carolina_state_only",
        notes: ["Official South Carolina Commerce announcement parsed into canonical strategic project rows."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "south_carolina_commerce_press_release",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 85,
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
        state: "SC",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:sc-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:sc-projects:${sourceNaturalId}`),
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
      rationale: "Resolved from official South Carolina Commerce strategic project announcement.",
    });
  }

  return bundle;
}
