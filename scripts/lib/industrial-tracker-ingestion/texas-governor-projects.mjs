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

const DEFAULT_TEXAS_PROJECT_URLS = [
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-dsm",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-coherent",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-ltd-material",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-arm-inc",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-komico",
  "https://gov.texas.gov/news/post/governor-abbott-announces-schneider-electric-expansion-in-el-paso",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-dongjin-semichem-texas",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-silicon-labs",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-spacex",
  "https://gov.texas.gov/news/post/governor-abbott-announces-ntxbio-facility-in-plano",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-tokyo-electron-u.s-holdings-inc",
  "https://gov.texas.gov/news/post/governor-abbott-announces-cancoil-manufacturing-facility-in-jacksonville",
  "https://gov.texas.gov/news/post/governor-abbott-announces-collins-aerospace-expansion-in-richardson",
  "https://gov.texas.gov/news/post/governor-abbott-announces-new-eli-lilly-manufacturing-investment-in-harris-county",
  "https://gov.texas.gov/news/post/governor-abbott-announces-texas-semiconductor-innovation-fund-grant-to-yerico-manufacturing",
];

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

function extractGrantUsd(text) {
  return parseAmountWithScale(
    firstMatch(text, [
      /\b(?:grant|fund grant)\D{0,40}?\$([\d.,]+)\s*(million|billion)\b/i,
      /\bgrant of\s+\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractCapexUsd(text) {
  return parseAmountWithScale(
    firstMatch(text, [
      /\b(?:capital investment|capital expenditures?|investment)\D{0,40}?\$([\d.,]+)\s*(million|billion)\b/i,
      /\bwill invest\s+more than\s+\$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+in capital investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+capital investment\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreate\s+more than\s+([\d,]+)\s+new jobs\b/i,
    /\bcreate\s+([\d,]+)\s+new jobs\b/i,
    /\bexpected to create\s+([\d,]+)\s+new jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractProgram(title, text) {
  const haystack = `${title} ${text}`;
  if (/Texas Semiconductor Innovation Fund|TSIF/i.test(haystack)) return "TSIF";
  if (/Texas Enterprise Fund|TEF/i.test(haystack)) return "TEF";
  if (/Texas Jobs, Energy, Technology, and Innovation|JETI/i.test(haystack)) return "JETI";
  return "Texas Strategic Projects";
}

function extractCompanyName(title, text) {
  const cleanedTitle = title.replace(/^Governor Abbott Announces\s+/i, "").trim();
  const titleMatch =
    firstMatch(cleanedTitle, [
      /^Texas Semiconductor Innovation Fund Grant To\s+(.+)$/i,
      /^New\s+(.+?)\s+Manufacturing Investment In\b/i,
      /^(.+?)\s+Expansion In\b/i,
      /^(.+?)\s+Facility In\b/i,
    ])?.[1] || null;

  if (titleMatch) {
    return titleMatch
      .replace(/\s+\(.+?\)\s*$/i, "")
      .trim();
  }

  const textMatch =
    firstMatch(text, [
      /\bannounced that\s+(.+?)\s+will\s+(?:construct|expand|modernize|establish)\b/i,
      /\bgrant of [^.!?]+? extended to\s+(.+?)\s+for\b/i,
    ])?.[1] || null;

  return textMatch?.replace(/[“”"]/g, "").trim() || cleanedTitle;
}

function extractLocation(title, text) {
  const countyMatch =
    firstMatch(title, [
      /\bin\s+([A-Za-z .'-]+? County)\b/i,
    ]) ||
    firstMatch(text, [
      /\bin\s+([A-Za-z .'-]+? County),?\s*Texas\b/i,
      /\bfor\s+([A-Za-z .'-]+? County)\b/i,
    ]) ||
    null;
  if (countyMatch?.[1]) {
    return {
      countyName: countyMatch[1].trim(),
      city: null,
      stateCode: "TX",
      label: `${countyMatch[1].trim()}, TX`,
    };
  }

  const cityMatch =
    firstMatch(title, [
      /\bin\s+([A-Za-z .'-]+)$/i,
    ]) ||
    firstMatch(text, [
      /\bfacility in\s+([A-Za-z .'-]+?),\s*Texas\b/i,
      /\bfacility in\s+([A-Za-z .'-]+?)\s+that\b/i,
      /\bfacility in\s+([A-Za-z .'-]+?)\s+will\b/i,
      /\boperations in\s+([A-Za-z .'-]+?),\s*Texas\b/i,
      /\bcampus in\s+([A-Za-z .'-]+?),\s*Texas\b/i,
    ]);

  if (cityMatch?.[1]) {
    const city = cityMatch[1].trim();
    const normalizedCity = city.toLowerCase();
    const looksBadCity =
      city.split(/\s+/).length > 4 ||
      normalizedCity.includes(" will ") ||
      normalizedCity.includes(" help ") ||
      normalizedCity.includes(" support ") ||
      normalizedCity.includes(" investment");
    if (looksBadCity) {
      return {
        countyName: null,
        city: null,
        stateCode: "TX",
        label: "Texas",
      };
    }
    return {
      countyName: null,
      city,
      stateCode: "TX",
      label: `${city}, TX`,
    };
  }

  return {
    countyName: null,
    city: null,
    stateCode: "TX",
    label: "Texas",
  };
}

function buildTechTags(title, text) {
  const tags = new Set(techTagsFromText(title, text));
  const haystack = `${title} ${text}`.toLowerCase();
  if (haystack.includes("semiconductor") || haystack.includes("chip")) tags.add("semiconductor");
  if (haystack.includes("quantum")) tags.add("quantum");
  if (haystack.includes("electric equipment") || haystack.includes("switchgear")) tags.add("grid_equipment");
  if (haystack.includes("biomanufacturing") || haystack.includes("pharmaceutical")) tags.add("biomanufacturing");
  if (haystack.includes("aerospace") || haystack.includes("defense")) tags.add("aerospace_defense");
  if (haystack.includes("api manufacturing")) tags.add("pharma_manufacturing");
  if (haystack.includes("advanced packaging")) tags.add("advanced_packaging");
  return Array.from(tags);
}

async function loadTexasCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.TX&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`TX:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchTexasProjectPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.TEXAS_PROJECTS_USER_AGENT ||
        process.env.SEC_USER_AGENT ||
        "Baseload Industrial Tracker contact@aibaseload.com",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Texas project fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();
  return {
    url,
    html,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "Texas strategic project",
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      null,
    text: stripHtml(html),
  };
}

export async function ingestTexasGovernorProjects() {
  const urls = readListEnv("TEXAS_PROJECT_URLS", DEFAULT_TEXAS_PROJECT_URLS);
  const countyMap = await loadTexasCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchTexasProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Texas Strategic Projects";

  for (const page of pages) {
    const companyName = extractCompanyName(page.title, page.text);
    const capexUsd = extractCapexUsd(page.text);
    const grantUsd = extractGrantUsd(page.text);
    const amount = capexUsd ?? grantUsd;
    if (!companyName || amount === null) continue;

    const location = extractLocation(page.title, page.text);
    const geo =
      location.countyName
        ? countyMap.get(`TX:${normalizeCountyName(location.countyName)}`) || null
        : null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "TX",
      countyName: geo?.county_name || location.countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const programName = extractProgram(page.title, page.text);
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const techTags = buildTechTags(page.title, page.text);
    const jobs = extractJobs(page.text);
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:tx-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:tx-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:tx-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:tx-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:tx-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:tx-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:tx-projects:${sourceNaturalId}`);

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
      metadata: {
        source: sourceName,
        program_name: programName,
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: `${companyName} ${programName === "TEF" ? "Expansion" : "Project"}`.trim(),
      normalized_name: normalizeName(companyName),
      address: {
        city: location.city || undefined,
        state: "TX",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: 82,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: location.label,
        program_name: programName,
        tech_tags: techTags,
      },
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: `${normalizeName(programName).replace(/\s+/g, "_")}_project`,
      sector: techTags[0] || "industrial",
      status: "announced",
      investment_amount: amount,
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      metadata: {
        source: sourceName,
        capital_investment_usd: capexUsd,
        incentive_award_usd: grantUsd,
        jobs_estimate: jobs,
        source_url: page.url,
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
        programName,
        companyName,
        capexUsd,
        grantUsd,
        jobs,
        location,
      },
      extraction_version: "texas-projects-v1",
    });

    bundle.investmentRows.push({
      id: eventId,
      source_record_id: sourceRecordId,
      geo_id: geoId,
      taxonomy_id: null,
      event_type: "strategic_capital_commitment",
      amount: String(amount),
      amount_type: capexUsd ? "commitment" : "incentive",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_entity_id: null,
      recipient_entity_id: companyId,
      facility_id: facilityId,
      provider_name: "Office of the Texas Governor",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "TX",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || location.countyName || null,
        label: location.label,
      },
      recipient_location: {
        city: location.city || null,
        state: "TX",
      },
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      jobs_estimate: jobs,
      capex_estimate: capexUsd,
      program_name: programName,
      award_type: programName,
      confidence_score: 84,
      provenance: {
        matchedEntityStrategy: "texas_governor_announcement_company_name",
        matchedFacilityStrategy: geoId ? "texas_governor_county_match" : "texas_governor_state_only",
        notes: ["Official Texas governor strategic project announcement parsed from public press release."],
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
      dataset: "texas_governor_project_announcements",
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      source_url: page.url,
      confidence_score: 87,
      raw_payload: {
        title: page.title,
        programName,
        capexUsd,
        grantUsd,
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
        program_name: programName,
        tech_tags: techTags,
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:tx-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      signal_id: signalId,
      metadata: {
        program_name: programName,
        location_label: location.label,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:tx-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: "0.8800",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        sectorAlignment: true,
      },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official Texas governor strategic project announcement.",
    });
  }

  return bundle;
}
