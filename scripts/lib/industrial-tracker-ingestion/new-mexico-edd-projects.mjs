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
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_NEW_MEXICO_POST_URLS = [
  "https://edd.newmexico.gov/wp-json/wp/v2/posts/37916",
  "https://edd.newmexico.gov/wp-json/wp/v2/posts/32256",
  "https://edd.newmexico.gov/wp-json/wp/v2/posts/22333",
  "https://edd.newmexico.gov/wp-json/wp/v2/posts/3474",
  "https://edd.newmexico.gov/wp-json/wp/v2/posts/3505",
];

const ARTICLE_OVERRIDES = new Map([
  [
    "37916",
    [
      {
        key: "hota-industrial-manufacturing",
        companyName: "Hota Industrial Manufacturing",
        facilityName: "Hota Industrial Santa Teresa Manufacturing Campus",
        city: "Santa Teresa",
        countyName: "Doña Ana County",
        amountUsd: 72_000_000,
        jobs: 350,
        techTags: ["advanced_manufacturing", "automotive", "metals", "borderplex"],
        sector: "advanced_manufacturing",
      },
    ],
  ],
  [
    "32256",
    [
      {
        key: "maxeon-solar",
        companyName: "Maxeon Solar Technologies",
        facilityName: "Maxeon Mesa del Sol Solar Manufacturing Complex",
        city: "Albuquerque",
        countyName: "Bernalillo County",
        amountUsd: 4_200_000_000,
        jobs: 1800,
        techTags: ["solar", "clean_energy", "advanced_manufacturing", "electronics"],
        sector: "clean_energy",
      },
    ],
  ],
  [
    "22333",
    [
      {
        key: "intel-rio-rancho",
        companyName: "Intel",
        facilityName: "Intel Rio Rancho Advanced Packaging Expansion",
        city: "Rio Rancho",
        countyName: "Sandoval County",
        amountUsd: 3_500_000_000,
        jobs: 700,
        techTags: ["semiconductor", "electronics", "advanced_manufacturing"],
        sector: "semiconductor",
      },
    ],
  ],
  [
    "3474",
    [
      {
        key: "savantx",
        companyName: "SavantX",
        facilityName: "SavantX Santa Fe Quantum Research Headquarters",
        city: "Santa Fe",
        countyName: "Santa Fe County",
        amountUsd: 500_000,
        jobs: 25,
        techTags: ["quantum", "ai", "software", "research"],
        sector: "quantum",
      },
    ],
  ],
  [
    "3505",
    [
      {
        key: "ganymede-games",
        companyName: "Ganymede Games",
        facilityName: "Ganymede Games Las Cruces Studio",
        city: "Las Cruces",
        countyName: "Doña Ana County",
        amountUsd: 1_300_000,
        jobs: 51,
        techTags: ["gaming", "software", "digital_infrastructure"],
        sector: "digital",
      },
      {
        key: "kairos-power",
        companyName: "Kairos Power",
        facilityName: "Kairos Power Mesa del Sol Research and Development Center",
        city: "Albuquerque",
        countyName: "Bernalillo County",
        amountUsd: 4_000_000,
        jobs: 65,
        techTags: ["advanced_energy", "nuclear", "research"],
        sector: "advanced_energy",
      },
    ],
  ],
]);

function stripHtml(html) {
  return String(html || "")
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

function normalizeCountyName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(county|parish|borough|city)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function postIdFromUrl(url) {
  const match = String(url).match(/posts\/(\d+)/);
  return match?.[1] || url;
}

function buildTechTags(title, description, text, override) {
  const tags = new Set([...(override?.techTags || []), ...techTagsFromText(title, description, text)]);
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("manufactur")) tags.add("advanced_manufacturing");
  if (haystack.includes("solar")) tags.add("solar");
  if (haystack.includes("semiconductor") || haystack.includes("chip")) tags.add("semiconductor");
  if (haystack.includes("quantum")) tags.add("quantum");
  if (haystack.includes("fusion") || haystack.includes("nuclear")) tags.add("advanced_energy");
  return Array.from(tags);
}

async function loadNewMexicoCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.NM&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`NM:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchJson(url, userAgent) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json,text/plain,*/*",
      },
    });
    if (!response.ok) {
      throw new Error(`New Mexico project fetch failed: ${response.status} ${url}`);
    }
    return await response.json();
  } catch (error) {
    const { stdout } = await execFileAsync("curl", [
      "-sL",
      "-A",
      userAgent,
      "-H",
      "Accept: application/json,text/plain,*/*",
      url,
    ]);
    if (!stdout?.trim()) throw error;
    return JSON.parse(stdout);
  }
}

async function fetchNewMexicoProjectPost(url) {
  const userAgent =
    process.env.NEW_MEXICO_PROJECTS_USER_AGENT ||
    process.env.SEC_USER_AGENT ||
    "Baseload Industrial Tracker contact@aibaseload.com";

  const post = await fetchJson(url, userAgent);
  return {
    apiUrl: url,
    postId: String(post.id || postIdFromUrl(url)),
    url: post.link || url,
    title: stripHtml(post.title?.rendered || "New Mexico strategic project"),
    description: stripHtml(post.excerpt?.rendered || ""),
    text: stripHtml(post.content?.rendered || ""),
    publishedAt: post.date_gmt || post.date || null,
  };
}

export async function ingestNewMexicoEddProjects() {
  const urls = readListEnv("NEW_MEXICO_PROJECT_URLS", DEFAULT_NEW_MEXICO_POST_URLS);
  const countyMap = await loadNewMexicoCountyMap();
  const posts = await Promise.all(urls.map((url) => fetchNewMexicoProjectPost(url)));
  const bundle = emptyBundle();
  const sourceName = "New Mexico Strategic Projects";

  for (const post of posts) {
    const overrides = ARTICLE_OVERRIDES.get(post.postId) || [];
    for (const override of overrides) {
      const geo = countyMap.get(`NM:${normalizeCountyName(override.countyName)}`) || null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "NM",
        countyName: geo?.county_name || override.countyName,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(post.publishedAt) || new Date().toISOString();
      const sourceNaturalId = `${post.url}#${override.key}`;
      const companyId = deterministicUuid(`entity:new-mexico-projects:${normalizeName(override.companyName)}`);
      const facilityId = deterministicUuid(`facility:new-mexico-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:new-mexico-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:new-mexico-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:new-mexico-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:new-mexico-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:new-mexico-projects:${sourceNaturalId}`);
      const techTags = buildTechTags(post.title, post.description, post.text, override);

      if (geoRow) bundle.geoRows.push(geoRow);

      bundle.entityRows.push({
        id: companyId,
        legal_name: override.companyName,
        normalized_name: normalizeName(override.companyName),
        entity_type: "company",
        country: "US",
        identifiers: {},
        aliases: [],
        confidence_score: 86,
        metadata: { source: sourceName },
      });

      bundle.facilityRows.push({
        id: facilityId,
        entity_id: companyId,
        geo_id: geoId,
        facility_name: override.facilityName,
        normalized_name: normalizeName(override.facilityName),
        address: {
          city: override.city,
          state: "NM",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: geoId ? 86 : 76,
        metadata: {
          source: sourceName,
          facility_type: "industrial_project_site",
          location_label: `${override.city}, NM`,
          tech_tags: techTags,
        },
      });

      bundle.sourceRows.push({
        id: sourceRecordId,
        source_system: sourceName,
        source_record_id: sourceNaturalId,
        source_category: "incentive",
        source_url: post.url,
        source_hash: sha256(`${post.title} ${post.text} ${override.key}`),
        fetched_at: new Date().toISOString(),
        effective_date: observedAt,
        raw_payload: {
          title: post.title,
          description: post.description,
          postId: post.postId,
          override,
          techTags,
        },
        extraction_version: "new-mexico-edd-projects-v1",
      });

      bundle.projectRows.push({
        id: projectId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_type: "industrial_expansion",
        investment_amount: override.amountUsd,
        sector: override.sector || "advanced_manufacturing",
        announcement_date: observedAt,
        construction_start: null,
        completion_estimate: null,
        status: "announced",
        metadata: {
          source: sourceName,
          jobs_estimate: override.jobs || null,
          source_url: post.url,
          description: post.description,
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
        provider_name: "State of New Mexico",
        recipient_name: override.companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "NM",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || override.countyName,
          label: `${override.city}, NM`,
        },
        recipient_location: {
          city: override.city,
          state: "NM",
        },
        jobs_estimate: override.jobs || null,
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        capex_estimate: String(override.amountUsd),
        program_name: "New Mexico EDD Strategic Projects",
        confidence_score: geoId ? 86 : 76,
        provenance: {
          matchedEntityStrategy: "new_mexico_edd_curated_company_override",
          matchedFacilityStrategy: geoId ? "new_mexico_county_match" : "new_mexico_city_only",
          notes: ["Official New Mexico EDD story parsed into canonical strategic project rows."],
        },
      });

      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        company_id: companyId,
        geo_id: geoId,
        project_id: projectId,
        dataset: "new_mexico_state_projects",
        source_name: sourceName,
        evidence_type: "state_project_announcement",
        observed_at: observedAt,
        confidence_score: 86,
        source_url: post.url,
        raw_payload: {
          title: post.title,
          description: post.description,
          url: post.url,
          companyName: override.companyName,
          amountUsd: override.amountUsd,
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
          source: sourceName,
          jobs_estimate: override.jobs || null,
          tech_tags: techTags,
        },
      });

      bundle.facilityEventRows.push({
        id: deterministicUuid(`facility-event:new-mexico-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        signal_id: signalId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        metadata: {
          location_label: `${override.city}, NM`,
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:new-mexico-projects:${sourceNaturalId}`),
        source_record_id: sourceRecordId,
        entity_id: companyId,
        facility_id: facilityId,
        decision_type: "deterministic",
        score: geoId ? "0.8600" : "0.7600",
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
        rationale: "Resolved from official New Mexico EDD strategic project announcement.",
      });
    }
  }

  return bundle;
}
