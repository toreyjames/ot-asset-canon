import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  safeNumber,
  sha256,
  supabaseFetch,
  techTagsFromText,
} from "./common.mjs";

const DEFAULT_KENTUCKY_FEED_URL =
  "https://cedky.com/api/3234235674/articles/nkynews-0-12";

const DEFAULT_KENTUCKY_PROJECT_SLUGS = new Set([
  "20260305_MarfoFMA",
  "20260226_GreenEnergy",
  "20260209_JamesComposites",
  "20260203_TateEvent",
  "20260129_GE",
  "20251218_MidwestEqMfg",
]);

const ARTICLE_OVERRIDES = {
  "20260305_MarfoFMA": {
    companyName: "MarfoFMA",
    countyName: "Kenton County",
    amount: 37_000_000,
    jobs: 78,
  },
  "20260226_GreenEnergy": {
    companyName: "Green Energy Parks",
    countyName: "Carlisle County",
    amount: 142_000_000,
    jobs: 20,
    techTags: ["energy"],
  },
  "20260209_JamesComposites": {
    companyName: "James Composites",
    countyName: "Marshall County",
    amount: 6_000_000,
    jobs: 25,
  },
  "20260203_TateEvent": {
    companyName: "Tate Inc.",
    countyName: "Barren County",
    amount: 76_000_000,
    jobs: 400,
  },
  "20260129_GE": {
    companyName: "GE Appliances",
    countyName: "Jefferson County",
    amount: 3_000_000_000,
    jobs: null,
    techTags: ["consumer_manufacturing"],
  },
  "20251218_MidwestEqMfg": {
    companyName: "Midwest Equipment Manufacturing",
    countyName: "Mason County",
    amount: 15_000_000,
    jobs: 66,
  },
};

const CITY_TO_COUNTY = {
  covington: "Kenton County",
  arlington: "Carlisle County",
  louisville: "Jefferson County",
  maysville: "Mason County",
};

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
      /\bover \$([\d.,]+)\s*(million|billion)\b/i,
      /\bnearly \$([\d.,]+)\s*(million|billion)\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\s+investment\b/i,
      /\b\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bcreating\s+([\d,]+)\s+(?:full-time\s+)?jobs\b/i,
    /\bcreating\s+([\d,]+)\s+new jobs\b/i,
    /\bcreate(?:s)?\s+([\d,]+)\s+jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCountyName(text) {
  const county = firstMatch(text, [/\b([A-Za-z .'-]+? County)\b/i])?.[1]?.trim();
  if (county) return county;

  const city = firstMatch(text, [
    /\bin\s+([A-Z][A-Za-z .'-]+)\b/,
    /\bat\s+global headquarters in\s+([A-Z][A-Za-z .'-]+)\b/i,
  ])?.[1]?.trim();

  if (city) {
    return CITY_TO_COUNTY[city.toLowerCase()] || null;
  }

  return null;
}

function extractCompanyName(title) {
  const cleaned = title.replace(/^Gov\. Beshear(?::)?\s*/i, "").trim();
  const match =
    firstMatch(cleaned, [
      /^Joins\s+(.+?)\s+To\b/i,
      /^(.+?)\s+To\s+(?:Open|Establish|Invest|Locate)\b/i,
      /^(.+?)\s+Joins\b/i,
      /^(.+?)\s+Congratulates\b/i,
      /^(.+?)\s+Awarded\b/i,
    ])?.[1] || null;

  return (match || cleaned).trim();
}

function buildTechTags(title, shortDesc) {
  const tags = new Set(techTagsFromText(title, shortDesc));
  const haystack = `${title} ${shortDesc}`.toLowerCase();
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("energy")) tags.add("energy");
  if (haystack.includes("water filter")) tags.add("consumer_manufacturing");
  if (haystack.includes("composites")) tags.add("advanced_materials");
  if (haystack.includes("frozen meals")) tags.add("food_manufacturing");
  return Array.from(tags);
}

function isRelevantArticle(article) {
  if (DEFAULT_KENTUCKY_PROJECT_SLUGS.has(String(article.post_slug || ""))) {
    return true;
  }

  const title = String(article.post_title || "");
  const shortDesc = String(article.post_short_desc || "");
  const haystack = `${title} ${shortDesc}`;

  if (!/\b(county|louisville|covington|maysville|marshall|barren|arlington)\b/i.test(haystack)) {
    return false;
  }

  if (!extractAmountUsd(haystack) && !extractJobs(haystack)) {
    return false;
  }

  if (
    /\b(governor'?s cup|exports|world economic forum|site and building development funding|sbir|awardees)\b/i.test(
      haystack
    )
  ) {
    return false;
  }

  return true;
}

async function loadKentuckyCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.KY&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`KY:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function loadKentuckyFeed() {
  const response = await fetch(process.env.KENTUCKY_CED_FEED_URL || DEFAULT_KENTUCKY_FEED_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        process.env.KENTUCKY_PROJECTS_USER_AGENT ||
        process.env.SEC_USER_AGENT ||
        "Baseload Industrial Tracker contact@aibaseload.com",
    },
  });

  if (!response.ok) {
    throw new Error(`Kentucky feed fetch failed: ${response.status}`);
  }

  return response.json();
}

export async function ingestKentuckyCedProjects() {
  const countyMap = await loadKentuckyCountyMap();
  const rows = await loadKentuckyFeed();
  const bundle = emptyBundle();
  const sourceName = "Kentucky Strategic Projects";

  for (const article of rows.filter(isRelevantArticle)) {
    const title = String(article.post_title || "");
    const shortDesc = String(article.post_short_desc || "");
    const combinedText = `${title} ${shortDesc}`;
    const override = ARTICLE_OVERRIDES[String(article.post_slug || "")] || null;
    const companyName = override?.companyName || extractCompanyName(title);
    const amount = override?.amount ?? extractAmountUsd(combinedText);
    if (!companyName || amount === null) continue;

    const countyName = override?.countyName || extractCountyName(combinedText);
    const geo = countyName
      ? countyMap.get(`KY:${normalizeCountyName(countyName)}`) || null
      : null;

    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "KY",
      countyName: geo?.county_name || countyName || null,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(article.post_publish_date) || new Date().toISOString();
    const jobs = override?.jobs ?? extractJobs(combinedText);
    const techTags = override?.techTags || buildTechTags(title, shortDesc);
    const sourceNaturalId = article.post_id || article.post_slug || title;
    const sourceUrl = article.post_slug
      ? `${process.env.KENTUCKY_CED_ARTICLE_BASE || "https://newkentuckyhome.ky.gov/news/Pages"}/${article.post_slug}.aspx`
      : process.env.KENTUCKY_CED_FEED_URL || DEFAULT_KENTUCKY_FEED_URL;

    const companyId = deterministicUuid(`entity:ky-projects:${normalizeName(companyName)}`);
    const facilityId = deterministicUuid(`facility:ky-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:ky-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:ky-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:ky-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:ky-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:ky-projects:${sourceNaturalId}`);

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
      facility_name: title,
      normalized_name: normalizeName(title),
      address: {
        state: "KY",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 84 : 74,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: countyName ? `${countyName}, KY` : "Kentucky",
        tech_tags: techTags,
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: String(sourceNaturalId),
      source_category: "incentive",
      source_url: sourceUrl,
      source_hash: sha256(combinedText),
      fetched_at: new Date().toISOString(),
      effective_date: observedAt,
      raw_payload: {
        title,
        short_desc: shortDesc,
        county_name: countyName,
        amount,
        jobs,
        techTags,
      },
      extraction_version: "kentucky-ced-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "industrial_expansion",
      investment_amount: amount,
      sector:
        techTags.includes("food_manufacturing")
          ? "food_manufacturing"
          : techTags.includes("consumer_manufacturing")
            ? "consumer_manufacturing"
            : techTags.includes("energy")
              ? "energy"
              : "advanced_manufacturing",
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      status: "announced",
      metadata: {
        source: sourceName,
        jobs_estimate: jobs,
        source_url: sourceUrl,
        description: shortDesc,
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
      provider_name: "Commonwealth of Kentucky",
      recipient_name: companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "KY",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || countyName || null,
        label: countyName ? `${countyName}, KY` : "Kentucky",
      },
      recipient_location: {
        state: "KY",
      },
      jobs_estimate: jobs,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: String(amount),
      program_name: "Kentucky Economic Development Strategic Announcements",
      confidence_score: geoId ? 84 : 74,
      provenance: {
        matchedEntityStrategy: "kentucky_ced_article_title_parse",
        matchedFacilityStrategy: geoId ? "kentucky_county_match" : "kentucky_state_only",
        notes: ["Official Kentucky economic development article feed parsed into canonical strategic project rows."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "kentucky_ced_article_feed",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 84,
      source_url: sourceUrl,
      raw_payload: {
        title,
        short_desc: shortDesc,
        county_name: countyName,
        amount,
        jobs,
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
        state: "KY",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:ky-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: countyName ? `${countyName}, KY` : "Kentucky",
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:ky-projects:${sourceNaturalId}`),
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
        countyName,
        techTags,
      },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official Kentucky economic development article feed.",
    });
  }

  return bundle;
}
