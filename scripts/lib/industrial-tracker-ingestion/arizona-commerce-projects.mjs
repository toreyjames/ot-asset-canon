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

const DEFAULT_ARIZONA_PROJECT_URLS = [
  "https://www.azcommerce.com/news-events/news/2026/3/az-and-japan-mou-signing/",
  "https://www.azcommerce.com/news-events/news/2026/2/2025-international-trade/",
  "https://www.azcommerce.com/news-events/news/2026/2/kayenta-groundbreaking/",
  "https://www.azcommerce.com/news-events/news/2026/2/aca-and-u-of-a-semiconductor-nano-fabrication-center/",
  "https://www.azcommerce.com/news-events/news/2026/1/dsv-groundbreaking/",
  "https://www.azcommerce.com/news-events/news/2026/1/komico-grand-opening/",
  "https://www.azcommerce.com/news-events/news/2025/12/kanto-ppc-groundbreaking/",
  "https://www.azcommerce.com/news-events/news/2025/12/ascent-grand-opening/",
  "https://www.azcommerce.com/news-events/news/2025/12/cognite-hq-grand-opening/",
  "https://www.azcommerce.com/news-events/news/2025/12/broadband-bead-approval-release/",
];

const CITY_TO_COUNTY = {
  phoenix: "Maricopa County",
  kayenta: "Navajo County",
  tucson: "Pima County",
  mesa: "Maricopa County",
  "casa grande": "Pinal County",
  marana: "Pima County",
  tempe: "Maricopa County",
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
      /\$([\d.,]+)\s*(million|billion)\s+in foreign direct investment\b/i,
      /\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\$([\d.,]+)\s*(million|billion)\s+expansion project\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreating thousands of new jobs\b/i,
    /\b([\d,]+)\s+jobs\b/i,
  ]);
  if (!match) return null;
  if (!match[1]) return 1000;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description, text) {
  if (/JETRO/i.test(title)) return "Japan External Trade Organization Collaboration";
  if (/Global Economic Powerhouse/i.test(title)) return "Arizona International Trade and Investment";
  if (/Nano Fabrication Center/i.test(title)) return "University of Arizona Nano Fabrication Center";
  const descMatch =
    firstMatch(description || "", [
      /^([A-Z][A-Za-z0-9&.,' -]+?)\s+\(/,
      /^([A-Z][A-Za-z0-9&.,' -]+?),\s+in partnership/i,
    ])?.[1] || null;
  if (descMatch) return descMatch.trim();

  const bodyMatch =
    firstMatch(text, [
      /\b([A-Z][A-Za-z0-9&.,' -]+?),\s+in partnership\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+today broke ground\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+today celebrated\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+announced today\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+relocates global headquarters\b/i,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)’s relocation and expansion project\b/,
    ])?.[1] || null;
  if (bodyMatch) return bodyMatch.trim();

  return title.replace(/\s+\|\s+.+$/, "").trim();
}

function extractLocation(title, text) {
  const cityMatch =
    firstMatch(title, [/\bFor\s+([A-Z][A-Za-z .'-]+)’s\b/i]) ||
    firstMatch(text, [
      /\b([A-Z][A-Za-z .'-]+),\s*AZ\b/,
      /\b([A-Z][A-Za-z .'-]+),\s*Arizona\b/,
    ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    const countyName = CITY_TO_COUNTY[city.toLowerCase()] || null;
    return {
      city,
      countyName,
      label: `${city}, AZ`,
    };
  }

  return {
    city: null,
    countyName: null,
    label: "Arizona",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("semiconductor")) tags.add("semiconductor");
  if (haystack.includes("trade")) tags.add("trade");
  if (haystack.includes("foreign direct investment")) tags.add("fdi");
  if (haystack.includes("expansion")) tags.add("expansion");
  if (haystack.includes("academic facilities") || haystack.includes("health labs")) tags.add("workforce_infrastructure");
  return Array.from(tags);
}

async function loadArizonaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.AZ&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`AZ:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchArizonaProjectPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.ARIZONA_PROJECTS_USER_AGENT ||
        process.env.SEC_USER_AGENT ||
        "Baseload Industrial Tracker contact@aibaseload.com",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Arizona project fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();
  return {
    url,
    html,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "Arizona strategic project",
    publishedAt:
      html.match(/<div class=\"font-size--sm text-muted pb-2 date\">([^<]+)<\/div>/i)?.[1]?.trim() ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "",
    text: stripHtml(html),
  };
}

export async function ingestArizonaCommerceProjects() {
  const urls = readListEnv("ARIZONA_PROJECT_URLS", DEFAULT_ARIZONA_PROJECT_URLS);
  const countyMap = await loadArizonaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchArizonaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Arizona Strategic Projects";

  for (const page of pages) {
    const companyName = extractCompanyName(page.title, page.description, page.text);
    const amount = extractAmountUsd(`${page.title} ${page.description} ${page.text}`);
    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, `${page.description} ${page.text}`);
    const geo =
      location.countyName
        ? countyMap.get(`AZ:${normalizeCountyName(location.countyName)}`) || null
        : null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "AZ",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const techTags = buildTechTags(page.title, page.description, page.text);
    const jobs = extractJobs(`${page.title} ${page.description} ${page.text}`);
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:az-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:az-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:az-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:az-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:az-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:az-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:az-projects:${sourceNaturalId}`);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 80,
      metadata: {
        source: sourceName,
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: page.title.replace(/\s+\|\s+.+$/, "").trim(),
      normalized_name: normalizeName(page.title),
      address: {
        city: location.city || undefined,
        state: "AZ",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: 76,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: location.label,
        tech_tags: techTags,
      },
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

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: page.url,
      source_category: "incentive",
      source_url: page.url,
      source_hash: sha256(page.html),
      effective_date: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        companyName,
        amount,
        jobs,
        location,
      },
      extraction_version: "arizona-commerce-projects-v1",
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
      provider_name: "Arizona Commerce Authority",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "AZ",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "AZ",
      },
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      jobs_estimate: jobs,
      capex_estimate: amount,
      program_name: sourceName,
      award_type: "ACA announcement",
      confidence_score: 78,
      provenance: {
        matchedEntityStrategy: "aca_news_company_parse",
        matchedFacilityStrategy: geoId ? "arizona_county_match" : "arizona_state_or_city_only",
        notes: ["Official Arizona Commerce Authority announcement parsed from public news page."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      source_name: sourceName,
      dataset: "arizona_commerce_project_announcements",
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      source_url: page.url,
      confidence_score: 82,
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
        tech_tags: techTags,
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:az-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      signal_id: signalId,
      metadata: {
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:az-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: "0.8200",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        sectorAlignment: true,
      },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official Arizona Commerce Authority strategic project announcement.",
    });
  }

  return bundle;
}
