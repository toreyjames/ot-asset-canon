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

const DEFAULT_CHIPS_AWARD_URLS = [
  "https://www.nist.gov/news-events/news/2025/01/us-department-commerce-announces-chips-incentives-awards-corning-edwards",
  "https://www.nist.gov/news-events/news/2025/01/department-commerce-announces-chips-incentives-award-hemlock-semiconductor",
  "https://www.nist.gov/news-events/news/2024/12/biden-harris-administration-announces-chips-incentives-awards-globalwafers",
];

const STATE_NAME_TO_CODE = {
  alabama: "AL",
  arizona: "AZ",
  california: "CA",
  florida: "FL",
  georgia: "GA",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  michigan: "MI",
  missouri: "MO",
  newyork: "NY",
  "new york": "NY",
  ohio: "OH",
  oregon: "OR",
  pennsylvania: "PA",
  texas: "TX",
  utah: "UT",
  virginia: "VA",
};

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
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

function normalizeStateCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length === 2) return normalized.toUpperCase();
  return STATE_NAME_TO_CODE[normalized] || null;
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

function extractAmountUsd(text) {
  const match = firstMatch(text, [
    /\b(?:award|incentives? award|direct funding|funding|incentives?)\D{0,40}?\$([\d.,]+)\s*(million|billion)\b/i,
    /\bup to\s+\$([\d.,]+)\s*(million|billion)\b/i,
  ]);
  if (!match) return null;
  const base = safeNumber(match[1]);
  if (base === null) return null;
  return match[2].toLowerCase() === "billion" ? base * 1_000_000_000 : base * 1_000_000;
}

function extractCapexUsd(text) {
  const match = firstMatch(text, [
    /\b(?:capital expenditures?|private investment|total investment)\D{0,40}?\$([\d.,]+)\s*(million|billion)\b/i,
    /\b\$([\d.,]+)\s*(million|billion)\b of capital expenditures\b/i,
  ]);
  if (!match) return null;
  const base = safeNumber(match[1]);
  if (base === null) return null;
  return match[2].toLowerCase() === "billion" ? base * 1_000_000_000 : base * 1_000_000;
}

function extractLocation(text) {
  const countyMatch = firstMatch(text, [
    /\(([A-Za-z .'-]+ County),\s*([A-Za-z .'-]+)\)/,
    /\bin\s+([A-Za-z .'-]+ County),\s*([A-Za-z .'-]+)/i,
  ]);
  if (countyMatch) {
    return {
      countyName: countyMatch[1].trim(),
      stateCode: normalizeStateCode(countyMatch[2]),
      locationLabel: `${countyMatch[1].trim()}, ${countyMatch[2].trim()}`,
    };
  }

  const cityStateMatch = firstMatch(text, [
    /\bin\s+([A-Z][A-Za-z .'-]+),\s*([A-Z][A-Za-z .'-]+)/,
    /\bLocation\s+([A-Z][A-Za-z .'-]+),\s*([A-Z][A-Za-z .'-]+)/,
  ]);
  if (cityStateMatch) {
    return {
      countyName: null,
      stateCode: normalizeStateCode(cityStateMatch[2]),
      locationLabel: `${cityStateMatch[1].trim()}, ${cityStateMatch[2].trim()}`,
    };
  }

  return {
    countyName: null,
    stateCode: null,
    locationLabel: null,
  };
}

function extractCompanyName(title, text) {
  const titleName =
    firstMatch(title, [
      /awards?\s+(.+?)$/i,
      /award to\s+(.+?)$/i,
      /for\s+(.+?)$/i,
    ])?.[1] || null;

  if (titleName) {
    return titleName
      .replace(/\s+and\s+subsidiary.*$/i, "")
      .replace(/\s+\|\s+.+$/, "")
      .trim();
  }

  const bodyName =
    firstMatch(text, [
      /announces? chips incentives? award(?:s)? to\s+([A-Z][A-Za-z0-9&.,' -]+)/i,
      /for\s+([A-Z][A-Za-z0-9&.,' -]+?),\s+the Department/i,
    ])?.[1] || null;

  return bodyName?.trim() || title.trim();
}

async function loadGeoMaps() {
  const geoRows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&limit=10000"
    )) || [];

  return {
    byCountyAndState: new Map(
      geoRows
        .filter((row) => row.county_name && row.state_code && row.county_fips)
        .map((row) => [
          `${row.state_code}:${normalizeCountyName(row.county_name)}`,
          row,
        ])
    ),
  };
}

async function fetchAwardPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.CHIPS_AWARDS_USER_AGENT ||
        process.env.SEC_USER_AGENT ||
        "Baseload Industrial Tracker contact@aibaseload.com",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`CHIPS award fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();
  return {
    url,
    html,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "CHIPS award",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      null,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      null,
    text: stripHtml(html),
  };
}

export async function ingestChipsAwards() {
  const urls = readListEnv("CHIPS_AWARD_URLS", DEFAULT_CHIPS_AWARD_URLS);
  const { byCountyAndState } = await loadGeoMaps();
  const pages = await Promise.all(urls.map((url) => fetchAwardPage(url)));
  const bundle = emptyBundle();

  for (const page of pages) {
    const companyName = extractCompanyName(page.title, page.text);
    const amount = extractAmountUsd(page.text);
    if (!companyName || amount === null) continue;

    const capexEstimate = extractCapexUsd(page.text);
    const location = extractLocation(page.text);
    const geo =
      location.countyName && location.stateCode
        ? byCountyAndState.get(
            `${location.stateCode}:${normalizeCountyName(location.countyName)}`
          ) || null
        : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: location.stateCode || geo?.state_code || null,
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: "CHIPS Awards" },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const companyId = deterministicUuid(`entity:chips:${normalizeName(companyName)}`);
    const projectId = deterministicUuid(`project:chips:${page.url}`);
    const sourceRecordId = deterministicUuid(`source:chips:${page.url}`);
    const evidenceId = deterministicUuid(`evidence:chips:${page.url}`);
    const eventId = deterministicUuid(`investment:chips:${page.url}`);
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const techTags = Array.from(
      new Set([
        "semiconductor",
        "advanced_manufacturing",
        ...techTagsFromText(page.title, page.description, page.text),
      ])
    );

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
      metadata: {
        source: "CHIPS Awards",
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: "CHIPS Awards",
      source_record_id: page.url,
      source_category: "incentive",
      source_url: page.url,
      source_hash: sha256(page.html),
      effective_date: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        publishedAt: page.publishedAt,
        location: location.locationLabel,
      },
      extraction_version: "chips-awards-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: null,
      company_id: companyId,
      geo_id: geoId,
      project_type: "chips_incentive",
      sector: "semiconductor",
      investment_amount: capexEstimate || amount,
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      status: "announced",
      metadata: {
        source: "CHIPS Awards",
        sourceUrl: page.url,
        location: location.locationLabel,
      },
    });

    bundle.investmentRows.push({
      id: eventId,
      source_record_id: sourceRecordId,
      provider_entity_id: null,
      recipient_entity_id: companyId,
      facility_id: null,
      geo_id: geoId,
      taxonomy_id: null,
      event_type: "chips_award",
      amount,
      amount_type: "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_name: "U.S. Department of Commerce",
      recipient_name: companyName,
      program_name: "CHIPS Incentives",
      award_type: "CHIPS award",
      sector_naics: "334413",
      psc_code: null,
      tech_tags: techTags,
      jobs_estimate: null,
      capex_estimate: capexEstimate,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: location.stateCode || geo?.state_code || null,
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.locationLabel,
      },
      recipient_location: null,
      confidence_score: geoId ? 88 : 74,
      provenance: {
        matchedEntityStrategy: "official_award_page",
        matchedFacilityStrategy: "none",
        notes: ["Official CHIPS award announcement parsed from NIST/Commerce page."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: null,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      source_name: "CHIPS Awards",
      dataset: "chips_award_pages",
      evidence_type: "chips_award_announced",
      source_url: page.url,
      confidence_score: geoId ? 88 : 74,
      observed_at: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        excerpt: page.text.slice(0, 4000),
      },
    });

    bundle.signalRows.push({
      id: deterministicUuid(`signal:chips:${page.url}`),
      facility_id: null,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "chips_award_announced",
      value: amount ? String(amount) : null,
      unit: "usd",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        source: "CHIPS Awards",
        techTags,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:chips:${page.url}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: null,
      decision_type: "official",
      score: geoId ? "0.9100" : "0.7800",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        addressMatch: 0,
        domainMatch: false,
        geoDistanceKm: null,
        sectorAlignment: true,
      },
      candidate_set: [companyId],
      chosen: true,
      rationale: "Matched company and geography from official CHIPS award page.",
    });
  }

  return bundle;
}
