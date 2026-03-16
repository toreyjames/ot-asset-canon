import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  readListEnv,
  sha256,
  supabaseFetch,
  techTagsFromText,
} from "./common.mjs";

const DEFAULT_WEST_VIRGINIA_PROJECT_URLS = [
  "https://westvirginia.gov/cmc-says-yes-to-west-virginia-building-a-state-of-the-art-steel-mill-in-the-mountain-state/",
  "https://westvirginia.gov/4-billion-data-center-campus-planned-for-berkeley-county-positioning-west-virginia-for-the-ai-and-cloud-economy/",
  "https://westvirginia.gov/gov-justice-announces-125-million-investment-from-babcock-wilcoxs-in-mason-county/",
  "https://westvirginia.gov/gov-justice-announces-59-million-investment-in-berkeley-county-from-handcraft-services-creating-220-new-jobs/",
  "https://westvirginia.gov/gov-justice-announces-35-million-investment-from-prime-6-to-establish-new-manufacturing-facility-in-upshur-county/",
  "https://westvirginia.gov/weyerhaeuser-commits-1-million-investment-to-strengthen-buckhannon-community/",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "cmc-says-yes-to-west-virginia-building-a-state-of-the-art-steel-mill-in-the-mountain-state",
    {
      companyName: "Commercial Metals Company",
      city: "Martinsburg",
      countyName: "Berkeley County",
      amountUsd: 450_000_000,
      techTags: ["metals", "advanced_manufacturing", "recycling"],
      facilityName: "CMC Berkeley Micro Mill",
    },
  ],
  [
    "4-billion-data-center-campus-planned-for-berkeley-county-positioning-west-virginia-for-the-ai-and-cloud-economy",
    {
      companyName: "Penzance Management",
      city: "Falling Waters",
      countyName: "Berkeley County",
      amountUsd: 4_000_000_000,
      jobs: 125,
      techTags: ["ai", "data_center", "cloud_infrastructure"],
      facilityName: "Bedington Data Center Campus",
    },
  ],
  [
    "gov-justice-announces-125-million-investment-from-babcock-wilcoxs-in-mason-county",
    {
      companyName: "Babcock & Wilcox",
      city: "Point Pleasant",
      countyName: "Mason County",
      amountUsd: 125_000_000,
      techTags: ["energy", "advanced_manufacturing", "industrial_equipment"],
      facilityName: "Babcock & Wilcox Mason Expansion",
    },
  ],
  [
    "gov-justice-announces-59-million-investment-in-berkeley-county-from-handcraft-services-creating-220-new-jobs",
    {
      companyName: "HandCraft Services",
      city: "Martinsburg",
      countyName: "Berkeley County",
      amountUsd: 59_000_000,
      jobs: 220,
      techTags: ["textiles", "healthcare_support", "advanced_manufacturing"],
      facilityName: "HandCraft Services Berkeley Facility",
    },
  ],
  [
    "gov-justice-announces-35-million-investment-from-prime-6-to-establish-new-manufacturing-facility-in-upshur-county",
    {
      companyName: "Prime 6",
      city: "Buckhannon",
      countyName: "Upshur County",
      amountUsd: 35_000_000,
      techTags: ["advanced_materials", "critical_minerals", "advanced_manufacturing"],
      facilityName: "Prime 6 Upshur Manufacturing Facility",
    },
  ],
  [
    "weyerhaeuser-commits-1-million-investment-to-strengthen-buckhannon-community",
    {
      companyName: "Weyerhaeuser",
      city: "Buckhannon",
      countyName: "Upshur County",
      amountUsd: 1_000_000,
      techTags: ["wood_products", "advanced_manufacturing"],
      facilityName: "Weyerhaeuser Buckhannon Investment",
    },
  ],
]);

function normalizeCountyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(county|parish|borough|city)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromUrl(url) {
  return String(url).split("/").filter(Boolean).pop() || url;
}

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

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("data center") || haystack.includes("cloud")) tags.add("data_center");
  if (haystack.includes("steel") || haystack.includes("mill")) tags.add("metals");
  if (haystack.includes("pipeline")) tags.add("pipeline");
  if (haystack.includes("manufacturing")) tags.add("advanced_manufacturing");
  return Array.from(tags);
}

async function loadWestVirginiaCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.WV&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`WV:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchWestVirginiaProjectPage(url) {
  const userAgent =
    process.env.WEST_VIRGINIA_PROJECTS_USER_AGENT ||
    process.env.SEC_USER_AGENT ||
    "Baseload Industrial Tracker contact@aibaseload.com";

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`West Virginia project fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();

  return {
    url,
    slug: slugFromUrl(url),
    html,
    title:
      extractMetaContent(html, "og:title") ||
      html.match(/<title>\s*([^<]+)\s*<\/title>/i)?.[1]?.trim() ||
      "West Virginia strategic project",
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

export async function ingestWestVirginiaEconomicDevelopmentProjects() {
  const urls = readListEnv("WEST_VIRGINIA_PROJECT_URLS", DEFAULT_WEST_VIRGINIA_PROJECT_URLS);
  const countyMap = await loadWestVirginiaCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchWestVirginiaProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "West Virginia Strategic Projects";

  for (const page of pages) {
    const override = ARTICLE_OVERRIDES.get(page.slug) || null;
    if (!override) continue;

    const geo = countyMap.get(`WV:${normalizeCountyName(override.countyName)}`) || null;
    const geoRow = buildGeoRow({
      countyFips: geo?.county_fips || null,
      stateCode: "WV",
      countyName: geo?.county_name || override.countyName,
      cbsaCode: geo?.cbsa_code || null,
      cbsaName: geo?.cbsa_name || null,
      metadata: { source: sourceName },
    });
    const geoId = geoRow?.id || geo?.id || null;
    const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
    const sourceNaturalId = page.url;
    const companyId = deterministicUuid(`entity:west-virginia-projects:${normalizeName(override.companyName)}`);
    const facilityId = deterministicUuid(`facility:west-virginia-projects:${sourceNaturalId}`);
    const sourceRecordId = deterministicUuid(`source:west-virginia-projects:${sourceNaturalId}`);
    const projectId = deterministicUuid(`project:west-virginia-projects:${sourceNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:west-virginia-projects:${sourceNaturalId}`);
    const signalId = deterministicUuid(`signal:west-virginia-projects:${sourceNaturalId}`);
    const eventId = deterministicUuid(`investment:west-virginia-projects:${sourceNaturalId}`);
    const techTags = buildTechTags(page.title, page.description, page.text, override);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: override.companyName,
      normalized_name: normalizeName(override.companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 87,
      metadata: { source: sourceName },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: override.facilityName || page.title,
      normalized_name: normalizeName(override.facilityName || page.title),
      address: {
        city: override.city,
        state: "WV",
        countyFips: geo?.county_fips || undefined,
      },
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      confidence_score: geoId ? 87 : 77,
      metadata: {
        source: sourceName,
        facility_type: "industrial_project_site",
        location_label: `${override.city}, WV`,
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
        companyName: override.companyName,
        amount: override.amountUsd,
        jobs: override.jobs || null,
        city: override.city,
        countyName: override.countyName,
      },
      extraction_version: "west-virginia-economic-development-projects-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: "state_strategic_project",
      sector: techTags[0] || "industrial",
      status: "announced",
      investment_amount: override.amountUsd,
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      metadata: {
        source: sourceName,
        jobs_estimate: override.jobs || null,
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
      amount: String(override.amountUsd),
      amount_type: "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_entity_id: null,
      recipient_entity_id: companyId,
      facility_id: facilityId,
      provider_name: "West Virginia Division of Economic Development",
      recipient_name: override.companyName,
      county_fips: geo?.county_fips || null,
      cbsa_code: geo?.cbsa_code || null,
      place_of_performance: {
        stateCode: "WV",
        countyFips: geo?.county_fips || null,
        countyName: geo?.county_name || override.countyName,
        label: `${override.city}, WV`,
      },
      recipient_location: {
        city: override.city,
        state: "WV",
      },
      jobs_estimate: override.jobs || null,
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      capex_estimate: override.amountUsd,
      program_name: "West Virginia Division of Economic Development",
      confidence_score: geoId ? 87 : 77,
      provenance: {
        matchedEntityStrategy: "west_virginia_override",
        matchedFacilityStrategy: geoId ? "west_virginia_county_match" : "west_virginia_state_or_city_only",
        notes: ["Official West Virginia Division of Economic Development strategic project announcement parsed from public release."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      dataset: "west_virginia_state_projects",
      source_name: sourceName,
      evidence_type: "state_incentive_announced",
      observed_at: observedAt,
      confidence_score: 87,
      source_url: page.url,
      raw_payload: {
        title: page.title,
        amount: override.amountUsd,
        jobs: override.jobs || null,
      },
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "state_incentive_recorded",
      value: String(override.amountUsd),
      unit: "USD",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        jobs: override.jobs || null,
        tech_tags: techTags,
        state: "WV",
      },
    });

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:west-virginia-projects:${sourceNaturalId}`),
      facility_id: facilityId,
      signal_id: signalId,
      event_type: "state_incentive_announced",
      occurred_at: observedAt,
      metadata: {
        location_label: `${override.city}, WV`,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:west-virginia-projects:${sourceNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "deterministic",
      score: geoId ? "0.8700" : "0.7700",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        sectorAlignment: true,
        companyName: override.companyName,
        location: {
          city: override.city,
          countyName: override.countyName,
        },
        techTags,
      },
      candidate_set: [companyId, facilityId],
      chosen: true,
      rationale: "Resolved from official West Virginia Division of Economic Development strategic project announcement.",
    });
  }

  return bundle;
}
