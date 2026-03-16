import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  isoDate,
  normalizeName,
  readListEnv,
  sha256,
  techTagsFromText,
} from "./common.mjs";

const DEFAULT_EDF_PROJECT_URLS = [
  "https://www.energy.gov/edf/aep",
  "https://www.energy.gov/edf/southern-company",
  "https://www.energy.gov/edf/crane-restart",
  "https://www.energy.gov/edf/wabash",
];

const STATE_NAME_TO_CODE = {
  alabama: "AL",
  georgia: "GA",
  indiana: "IN",
  ohio: "OH",
  pennsylvania: "PA",
  texas: "TX",
  "west virginia": "WV",
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

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function extractTableField(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<td[^>]*>${escaped}<\\/td><td[^>]*>([\\s\\S]*?)<\\/td>`, "i")
  );
  if (!match?.[1]) return null;
  return stripHtml(match[1]);
}

function parseMoneyToUsd(value) {
  const match = String(value || "").match(/\$([\d.,]+)\s*(million|billion)/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  return match[2].toLowerCase() === "billion" ? amount * 1_000_000_000 : amount * 1_000_000;
}

function parseJobs(value) {
  const match = String(value || "").match(/([\d,]+)/);
  if (!match) return null;
  const amount = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(amount) ? amount : null;
}

function parseMonthYearToIso(value) {
  const parsed = new Date(`${value} 01`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function deriveLocation(label) {
  const normalized = String(label || "").trim();
  if (!normalized) {
    return { stateCode: null, locationLabel: null, isMultiState: false };
  }

  if (/various locations/i.test(normalized)) {
    return { stateCode: null, locationLabel: normalized, isMultiState: true };
  }

  const states = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  if (states.length === 2) {
    return {
      stateCode: normalizeStateCode(states[1]),
      locationLabel: normalized,
      isMultiState: false,
    };
  }

  if (/^[A-Z]{2}(,\s*[A-Z]{2})+$/.test(normalized)) {
    return {
      stateCode: null,
      locationLabel: normalized,
      isMultiState: true,
    };
  }

  return {
    stateCode: normalizeStateCode(normalized),
    locationLabel: normalized,
    isMultiState: false,
  };
}

function buildTechTags(title, summary, sector) {
  const tags = new Set(
    techTagsFromText(title, summary, sector)
  );
  if (/nuclear/i.test(sector || summary)) tags.add("advanced_nuclear");
  if (/transmission|grid|utilities/i.test(sector || summary)) tags.add("grid_infrastructure");
  if (/coal|hydrocarbon|ammonia|fertilizer/i.test(summary || sector)) tags.add("industrial_commodities");
  return Array.from(tags);
}

async function fetchProjectPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.DOE_EDF_USER_AGENT ||
        process.env.SEC_USER_AGENT ||
        "Baseload Industrial Tracker contact@aibaseload.com",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`DOE EDF fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();
  const title =
    extractMetaContent(html, "og:title") ||
    extractMetaContent(html, "twitter:title") ||
    html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
    url;

  return {
    url,
    html,
    title,
    description:
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      null,
    publishedAt:
      extractMetaContent(html, "article:published_time") ||
      extractMetaContent(html, "og:published_time") ||
      null,
  };
}

export async function ingestDoeEdfProjects() {
  const urls = readListEnv("DOE_EDF_PROJECT_URLS", DEFAULT_EDF_PROJECT_URLS);
  const pages = await Promise.all(urls.map((url) => fetchProjectPage(url)));
  const bundle = emptyBundle();

  for (const page of pages) {
    const owners = extractTableField(page.html, "Owners");
    const locations = extractTableField(page.html, "Locations");
    const sector = extractTableField(page.html, "EDF Tech Sector");
    const loanProgram = extractTableField(page.html, "Loan Program");
    const loanType = extractTableField(page.html, "Loan Type");
    const loanAmountLabel = extractTableField(page.html, "Loan Amount");
    const issuanceDateLabel = extractTableField(page.html, "Issuance Date");
    const permanentJobsLabel =
      extractTableField(page.html, "Permanent U.S. Jobs Supported") ||
      extractTableField(page.html, "U.S. Jobs Supported *");
    const constructionJobsLabel = extractTableField(page.html, "U.S. Construction Jobs Supported *");
    const summaryMatch = page.html.match(
      /<h5><strong>PROJECT SUMMARY<\/strong><\/h5><p>([\s\S]*?)<\/p>/i
    );
    const summaryText = summaryMatch ? stripHtml(summaryMatch[1]) : page.description || "";

    const companyName = owners || page.title.replace(/^EDF Project Page:\s*/i, "").trim();
    const amount = parseMoneyToUsd(loanAmountLabel);
    if (!companyName || amount === null) continue;

    const observedAt =
      parseMonthYearToIso(issuanceDateLabel) ||
      isoDate(page.publishedAt) ||
      new Date().toISOString();
    const location = deriveLocation(locations);
    const geoRow = !location.isMultiState && location.stateCode
      ? buildGeoRow({
          countyFips: null,
          stateCode: location.stateCode,
          countyName: null,
          metadata: { source: "DOE EDF Projects" },
        })
      : null;
    const geoId = geoRow?.id || null;
    const companyId = deterministicUuid(`entity:doe-edf:${normalizeName(companyName)}`);
    const projectId = deterministicUuid(`project:doe-edf:${page.url}`);
    const sourceRecordId = deterministicUuid(`source:doe-edf:${page.url}`);
    const evidenceId = deterministicUuid(`evidence:doe-edf:${page.url}`);
    const signalId = deterministicUuid(`signal:doe-edf:${page.url}`);
    const eventId = deterministicUuid(`investment:doe-edf:${page.url}`);
    const techTags = buildTechTags(page.title, summaryText, sector || "");
    const permanentJobs = parseJobs(permanentJobsLabel);
    const constructionJobs = parseJobs(constructionJobsLabel);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {},
      aliases: [],
      confidence_score: 87,
      metadata: { source: "DOE EDF Projects" },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: "DOE EDF Projects",
      source_record_id: page.url,
      source_category: "project_finance",
      source_url: page.url,
      source_hash: sha256(page.html),
      effective_date: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        owners,
        locations,
        sector,
        loanAmountLabel,
        issuanceDateLabel,
      },
      extraction_version: "doe-edf-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: null,
      company_id: companyId,
      geo_id: geoId,
      project_type: "doe_edf_project",
      sector: sector ? toTitleCase(sector) : "energy_infrastructure",
      investment_amount: amount,
      announcement_date: observedAt,
      construction_start: null,
      completion_estimate: null,
      status: "active",
      metadata: {
        source: "DOE EDF Projects",
        sourceUrl: page.url,
        location: location.locationLabel,
        loanProgram,
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
      event_type: "doe_edf_financing",
      amount,
      amount_type: "commitment",
      currency: "USD",
      announced_date: observedAt,
      action_date: observedAt,
      start_date: null,
      end_date: null,
      provider_name: "U.S. Department of Energy",
      recipient_name: companyName,
      program_name: loanProgram || "Energy Dominance Financing Program",
      award_type: loanType || "Loan",
      sector_naics: null,
      psc_code: null,
      tech_tags: techTags,
      jobs_estimate: permanentJobs || constructionJobs,
      capex_estimate: amount,
      county_fips: null,
      cbsa_code: null,
      place_of_performance: {
        stateCode: location.stateCode,
        countyFips: null,
        countyName: null,
        label: location.locationLabel,
      },
      recipient_location: null,
      confidence_score: geoId ? 84 : 72,
      provenance: {
        matchedEntityStrategy: "official_project_page",
        matchedFacilityStrategy: "none",
        notes: ["Official DOE EDF project page parsed from structured project statistics table."],
      },
    });

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: null,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      source_name: "DOE EDF Projects",
      dataset: "doe_edf_project_pages",
      evidence_type: "doe_financing_announced",
      source_url: page.url,
      confidence_score: geoId ? 84 : 72,
      observed_at: observedAt,
      raw_payload: {
        title: page.title,
        description: page.description,
        summary: summaryText,
      },
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: null,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: "doe_financing_announced",
      value: String(amount),
      unit: "usd",
      evidence_id: evidenceId,
      observed_at: observedAt,
      metadata: {
        source: "DOE EDF Projects",
        sector,
        techTags,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:doe-edf:${page.url}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: null,
      decision_type: "official",
      score: geoId ? "0.8800" : "0.7300",
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
      rationale: "Matched company and project financing from official DOE EDF project page.",
    });
  }

  return bundle;
}
