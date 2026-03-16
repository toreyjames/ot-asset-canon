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

const DEFAULT_MICHIGAN_PROJECT_URLS = [
  "https://www.michiganbusiness.org/press-releases/2026/03/new-jobs-coming-to-up-expansion-project-in-mellen-township/",
  "https://www.michiganbusiness.org/press-releases/2025/12/whitmer-1300-jobs-240-million-investment/",
  "https://www.michiganbusiness.org/press-releases/2025/12/accelerating-advanced-air-mobility/",
  "https://www.michiganbusiness.org/press-releases/2025/12/msf-projects-grand-rapids-kalamazoo/",
  "https://www.michiganbusiness.org/press-releases/2025/11/miller-industries-expansion-genesee-county/",
  "https://www.michiganbusiness.org/press-releases/2025/10/medical-technology-company-expands-in-oakland-county/",
  "https://www.michiganbusiness.org/press-releases/2025/10/high-tech-and-clean-energy-investments/",
  "https://www.michiganbusiness.org/press-releases/2025/09/220-million-in-investments/",
];

const CITY_TO_COUNTY = {
  "grand rapids": "Kent County",
  kalamazoo: "Kalamazoo County",
  detroit: "Wayne County",
  lansing: "Ingham County",
  mason: "Ingham County",
  cadillac: "Wexford County",
  escanaba: "Delta County",
  marquette: "Marquette County",
  zeeland: "Ottawa County",
  wixom: "Oakland County",
  "auburn hills": "Oakland County",
  plymouth: "Wayne County",
  lapeer: "Lapeer County",
  fenton: "Genesee County",
  ovid: "Clinton County",
  "wheatland township": "Mecosta County",
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
      /\$([\d.,]+)\s*(million|billion)\s+(?:invested|investment|capital investment)\b/i,
      /\binvesting more than\s+\$([\d.,]+)\s*(million|billion)\b/i,
      /\bdeploys more than\s+\$([\d.,]+)\s*(million|billion)\b/i,
      /\btotal capital investment of over\s+\$([\d.,]+)\s*(million|billion)\b/i,
      /\bexpansion project.*?\$([\d.,]+)\s*(million|billion)\b/i,
    ])
  );
}

function extractJobs(text) {
  const match = firstMatch(text, [
    /\bmore than\s+([\d,]+)\s+jobs\b/i,
    /\b([\d,]+)\s+new jobs\b/i,
    /\bcreating or retaining more than\s+([\d,]+)\s+jobs\b/i,
  ]);
  if (!match?.[1]) return null;
  const jobs = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(jobs) ? jobs : null;
}

function extractCompanyName(title, description, text) {
  const descMatch =
    firstMatch(description || "", [
      /^([A-Z][A-Za-z0-9&.,' -]+?),\s+is\b/,
      /^([A-Z][A-Za-z0-9&.,' -]+?)\s+plans to\b/i,
    ])?.[1] || null;
  if (descMatch) return descMatch.trim();

  const bodyMatch =
    firstMatch(text, [
      /\b([A-Z][A-Za-z0-9&.,' -]+?),\s+is a\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+will expand\b/,
      /\b([A-Z][A-Za-z0-9&.,' -]+?)\s+committed to creating\b/,
    ])?.[1] || null;
  if (bodyMatch) return bodyMatch.trim();

  const cleanedTitle = title.replace(/\s+\|\s+Michigan Business$/i, "").trim();
  if (/^Michigan Deploys /i.test(cleanedTitle)) return "State of Michigan Advanced Air Mobility Initiative";
  if (/^Michigan Strategic Fund Board Approves /i.test(cleanedTitle)) return "Michigan Strategic Fund Board";
  if (/^Governor Whitmer Announces /i.test(cleanedTitle)) return "State of Michigan Strategic Projects";
  return cleanedTitle;
}

function extractLocation(title, text) {
  const countyMatch =
    firstMatch(title, [/\b([A-Za-z .'-]+? County)\b/i]) ||
    firstMatch(text, [/\b([A-Za-z .'-]+? County),\s*Michigan\b/i]);
  if (countyMatch?.[1]) {
    return {
      countyName: countyMatch[1].trim(),
      city: null,
      label: `${countyMatch[1].trim()}, MI`,
    };
  }

  const townshipMatch = firstMatch(title, [/\bin\s+([A-Za-z .'-]+ Township)\b/i]);
  if (townshipMatch?.[1]) {
    return {
      countyName: null,
      city: townshipMatch[1].trim(),
      label: `${townshipMatch[1].trim()}, MI`,
    };
  }

  const cityMatch =
    firstMatch(title, [/\bin\s+([A-Z][A-Za-z .'-]+(?:,\s*[A-Z][A-Za-z .'-]+)*)$/]) ||
    firstMatch(text, [
      /\bin\s+([A-Z][A-Za-z .'-]+),\s*Michigan\b/,
      /\bto\s+([A-Z][A-Za-z .'-]+),\s*Michigan\b/,
    ]);

  if (cityMatch?.[1]) {
    const firstCity = cityMatch[1].split(",")[0].trim();
    const countyName = CITY_TO_COUNTY[firstCity.toLowerCase()] || null;
    return {
      countyName,
      city: firstCity,
      label: `${firstCity}, MI`,
    };
  }

  return {
    countyName: null,
    city: null,
    label: "Michigan",
  };
}

function buildTechTags(title, description, text) {
  const tags = new Set(techTagsFromText(title, description, text));
  const haystack = `${title} ${description} ${text}`.toLowerCase();
  if (haystack.includes("advanced air mobility")) tags.add("advanced_air_mobility");
  if (haystack.includes("defense")) tags.add("defense");
  if (haystack.includes("aerospace")) tags.add("aerospace_defense");
  if (haystack.includes("manufactur") || haystack.includes("fabrication")) tags.add("advanced_manufacturing");
  if (haystack.includes("mobility")) tags.add("mobility");
  if (haystack.includes("semiconductor")) tags.add("semiconductor");
  return Array.from(tags);
}

function buildSplitEntry({
  slug,
  companyName,
  amount,
  jobs,
  city = null,
  countyName = null,
  title,
  description = "",
  text = "",
}) {
  return {
    slug,
    companyName,
    amount,
    jobs,
    location: {
      city,
      countyName,
      label: city ? `${city}, MI` : countyName ? `${countyName}, MI` : "Michigan",
    },
    title,
    description,
    techTags: buildTechTags(title, description, text),
  };
}

function extractMichiganSplitEntries(page) {
  const text = `${page.title} ${page.description} ${page.text}`;

  if (page.url.includes("/2025/09/220-million-in-investments/")) {
    const entries = [];

    const jr = text.match(
      /JR Automation.*?create at least\s+(\d+)\s+jobs and invest at least \$([\d.]+)\s+million.*?facility in\s+Zeeland\s+\(Ottawa County\)/i
    );
    if (jr) {
      entries.push(
        buildSplitEntry({
          slug: "jr-automation-zeeland",
          companyName: "JR Automation",
          jobs: Number.parseInt(jr[1], 10),
          amount: safeNumber(jr[2]) * 1_000_000,
          city: "Zeeland",
          countyName: "Ottawa County",
          title: "JR Automation Zeeland Expansion",
          description: "Global headquarters and smart manufacturing expansion in Zeeland.",
          text,
        })
      );
    }

    const astemo = text.match(
      /Astemo Americas, Inc\., will invest \$([\d.]+)\s+million.*?in\s+Wixom\s+\(Oakland County\).*?expected to create\s+(\d+)\s+new jobs/i
    );
    if (astemo) {
      entries.push(
        buildSplitEntry({
          slug: "astemo-wixom",
          companyName: "Astemo Americas",
          jobs: Number.parseInt(astemo[2], 10),
          amount: safeNumber(astemo[1]) * 1_000_000,
          city: "Wixom",
          countyName: "Oakland County",
          title: "Astemo Americas Wixom Complex",
          description: "Regional headquarters and tech center investment in Wixom.",
          text,
        })
      );
    }

    const rheinmetall = text.match(
      /approved a \$([\d.]+)\s+million Michigan Business Development Program .*?create at least\s+(\d+)\s+new jobs and invest at least \$([\d.]+)\s+million across\s+Auburn Hills/i
    );
    if (rheinmetall) {
      entries.push(
        buildSplitEntry({
          slug: "american-rheinmetall-michigan",
          companyName: "American Rheinmetall",
          jobs: Number.parseInt(rheinmetall[2], 10),
          amount: safeNumber(rheinmetall[3]) * 1_000_000,
          city: "Auburn Hills",
          countyName: "Oakland County",
          title: "American Rheinmetall Michigan Expansion",
          description: "Defense manufacturing expansion across Southeast Michigan.",
          text,
        })
      );
    }

    const healthbridge = text.match(
      /HealthBridge Financial.*?create at least\s+(\d+)\s+new jobs in Kent County and invest roughly \$([\d.]+)\s+million/i
    );
    if (healthbridge) {
      entries.push(
        buildSplitEntry({
          slug: "healthbridge-grand-rapids",
          companyName: "HealthBridge Financial",
          jobs: Number.parseInt(healthbridge[1], 10),
          amount: safeNumber(healthbridge[2]) * 1_000_000,
          city: "Grand Rapids",
          countyName: "Kent County",
          title: "HealthBridge West Michigan Expansion",
          description: "FinTech expansion in Grand Rapids.",
          text,
        })
      );
    }

    const ovid = text.match(
      /City of Ovid.*?create\s+(\d+)\s+jobs.*?estimated \$([\d.]+)\s+million investment in Eligible Personal Property/i
    );
    if (ovid) {
      entries.push(
        buildSplitEntry({
          slug: "mmpa-ovid",
          companyName: "Michigan Milk Producers Association",
          jobs: Number.parseInt(ovid[1], 10),
          amount: safeNumber(ovid[2]) * 1_000_000,
          city: "Ovid",
          countyName: "Clinton County",
          title: "MMPA Ovid Dairy Expansion",
          description: "Ultrafiltered milk processing expansion in Ovid.",
          text,
        })
      );
    }

    const wheatland = text.match(
      /Wheatland Township.*?create\s+(\d+)\s+jobs.*?estimated \$([\d.]+)\s+million investment in Eligible Personal Property/i
    );
    if (wheatland) {
      entries.push(
        buildSplitEntry({
          slug: "mmpa-wheatland",
          companyName: "Michigan Milk Producers Association",
          jobs: Number.parseInt(wheatland[1], 10),
          amount: safeNumber(wheatland[2]) * 1_000_000,
          city: "Wheatland Township",
          countyName: "Mecosta County",
          title: "MMPA Wheatland Dairy Plant",
          description: "Cultured dairy equipment and production capabilities in Wheatland Township.",
          text,
        })
      );
    }

    return entries;
  }

  if (page.url.includes("/2025/12/msf-projects-grand-rapids-kalamazoo/")) {
    const entries = [];
    const officeTower = text.match(
      /The office tower.*?\$([\d.]+)\s+million in private investment.*?supporting\s+([\d,]+)\s+direct permanent jobs/i
    );
    if (officeTower) {
      entries.push(
        buildSplitEntry({
          slug: "grand-rapids-office-tower",
          companyName: "Magellan Development Group",
          jobs: Number.parseInt(officeTower[2].replace(/,/g, ""), 10),
          amount: safeNumber(officeTower[1]) * 1_000_000,
          city: "Grand Rapids",
          countyName: "Kent County",
          title: "Grand Rapids Office Tower",
          description: "Office tower component of the Fulton & Market transformational redevelopment.",
          text,
        })
      );
    }

    const hotelTower = text.match(
      /The hotel tower.*?create\s+([\d,]+)\s+direct permanent jobs.*?\$([\d.]+)\s+million in anticipated private investment/i
    );
    if (hotelTower) {
      entries.push(
        buildSplitEntry({
          slug: "grand-rapids-hotel-tower",
          companyName: "Magellan Development Group",
          jobs: Number.parseInt(hotelTower[1].replace(/,/g, ""), 10),
          amount: safeNumber(hotelTower[2]) * 1_000_000,
          city: "Grand Rapids",
          countyName: "Kent County",
          title: "Grand Rapids Hotel Tower",
          description: "Hotel and mixed-use residential component of the Fulton & Market redevelopment.",
          text,
        })
      );
    }

    const residentialTower = text.match(
      /Finally,\s+the residential tower.*?creation of\s+([\d,]+)\s+direct permanent jobs.*?\$([\d.]+)\s+million/i
    );
    if (residentialTower) {
      entries.push(
        buildSplitEntry({
          slug: "grand-rapids-residential-tower",
          companyName: "Magellan Development Group",
          jobs: Number.parseInt(residentialTower[1].replace(/,/g, ""), 10),
          amount: safeNumber(residentialTower[2]) * 1_000_000,
          city: "Grand Rapids",
          countyName: "Kent County",
          title: "Grand Rapids Residential Tower",
          description: "Residential tower component of the Fulton & Market redevelopment.",
          text,
        })
      );
    }

    const kalamazoo = text.match(
      /PlazaCorp Realty Advisors.*?Kalamazoo\s+\(Kalamazoo County\).*?create(?:\s+up\s+to)?\s+(\d+)\s+jobs.*?invest approximately \$([\d.]+)\s+million/i
    );
    if (kalamazoo) {
      entries.push(
        buildSplitEntry({
          slug: "kalamazoo-plazacorp",
          companyName: "PlazaCorp Realty Advisors",
          jobs: Number.parseInt(kalamazoo[1], 10),
          amount: safeNumber(kalamazoo[2]) * 1_000_000,
          city: "Kalamazoo",
          countyName: "Kalamazoo County",
          title: "Kalamazoo Downtown Redevelopment",
          description: "PlazaCorp redevelopment package in downtown Kalamazoo.",
          text,
        })
      );
    }

    return entries;
  }

  return [];
}

async function loadMichiganCountyMap() {
  const rows =
    (await supabaseFetch(
      "geo_dim?select=id,county_fips,county_name,state_code,cbsa_code,cbsa_name&state_code=eq.MI&limit=1000"
    )) || [];

  return new Map(
    rows
      .filter((row) => row.county_name && row.county_fips)
      .map((row) => [`MI:${normalizeCountyName(row.county_name)}`, row])
  );
}

async function fetchMichiganProjectPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.MICHIGAN_PROJECTS_USER_AGENT ||
        process.env.SEC_USER_AGENT ||
        "Baseload Industrial Tracker contact@aibaseload.com",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Michigan project fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();
  return {
    url,
    html,
    title:
      extractMetaContent(html, "og:title") ||
      extractMetaContent(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ||
      "Michigan strategic project",
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

export async function ingestMichiganMedcProjects() {
  const urls = readListEnv("MICHIGAN_PROJECT_URLS", DEFAULT_MICHIGAN_PROJECT_URLS);
  const countyMap = await loadMichiganCountyMap();
  const pages = await Promise.all(urls.map((url) => fetchMichiganProjectPage(url)));
  const bundle = emptyBundle();
  const sourceName = "Michigan Strategic Projects";

  for (const page of pages) {
    const splitEntries = extractMichiganSplitEntries(page);
    const entries =
      splitEntries.length > 0
        ? splitEntries
        : [
            {
              slug: "default",
              companyName: extractCompanyName(page.title, page.description, page.text),
              amount: extractAmountUsd(`${page.title} ${page.description} ${page.text}`),
              jobs: extractJobs(`${page.title} ${page.description} ${page.text}`),
              location: extractLocation(page.title, `${page.description} ${page.text}`),
              title: page.title.replace(/\s+\|\s+Michigan Business$/i, "").trim(),
              description: page.description,
              techTags: buildTechTags(page.title, page.description, page.text),
            },
          ];

    for (const entry of entries) {
      const companyName = entry.companyName;
      const amount = entry.amount;
      if (!companyName || amount === null) continue;

      const location = entry.location;
      const geo =
        location.countyName
          ? countyMap.get(`MI:${normalizeCountyName(location.countyName)}`) || null
          : null;
      const geoRow = buildGeoRow({
        countyFips: geo?.county_fips || null,
        stateCode: "MI",
        countyName: geo?.county_name || location.countyName || null,
        cbsaCode: geo?.cbsa_code || null,
        cbsaName: geo?.cbsa_name || null,
        metadata: { source: sourceName },
      });
      const geoId = geoRow?.id || geo?.id || null;
      const observedAt = isoDate(page.publishedAt) || new Date().toISOString();
      const techTags = entry.techTags;
      const jobs = entry.jobs;
      const sourceNaturalId = `${page.url}#${entry.slug}`;
      const companyId = deterministicUuid(`entity:mi-projects:${normalizeName(companyName)}`);
      const facilityId = deterministicUuid(`facility:mi-projects:${sourceNaturalId}`);
      const sourceRecordId = deterministicUuid(`source:mi-projects:${sourceNaturalId}`);
      const projectId = deterministicUuid(`project:mi-projects:${sourceNaturalId}`);
      const evidenceId = deterministicUuid(`evidence:mi-projects:${sourceNaturalId}`);
      const signalId = deterministicUuid(`signal:mi-projects:${sourceNaturalId}`);
      const eventId = deterministicUuid(`investment:mi-projects:${sourceNaturalId}`);

      if (geoRow) bundle.geoRows.push(geoRow);

      bundle.entityRows.push({
        id: companyId,
        legal_name: companyName,
        normalized_name: normalizeName(companyName),
        entity_type: "company",
        country: "US",
        identifiers: {},
        aliases: [],
        confidence_score: 82,
        metadata: {
          source: sourceName,
        },
      });

      bundle.facilityRows.push({
        id: facilityId,
        entity_id: companyId,
        geo_id: geoId,
        facility_name: entry.title,
        normalized_name: normalizeName(entry.title),
        address: {
          city: location.city || undefined,
          state: "MI",
          countyFips: geo?.county_fips || undefined,
        },
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        confidence_score: 78,
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
          description: entry.description,
        },
      });

      bundle.sourceRows.push({
        id: sourceRecordId,
        source_system: sourceName,
        source_record_id: sourceNaturalId,
        source_category: "incentive",
        source_url: page.url,
        source_hash: sha256(`${page.html}:${entry.slug}`),
        effective_date: observedAt,
        raw_payload: {
          title: entry.title,
          description: entry.description,
          companyName,
          amount,
          jobs,
          location,
        },
        extraction_version: "michigan-medc-projects-v2",
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
        provider_name: "Michigan Economic Development Corporation",
        recipient_name: companyName,
        county_fips: geo?.county_fips || null,
        cbsa_code: geo?.cbsa_code || null,
        place_of_performance: {
          stateCode: "MI",
          countyFips: geo?.county_fips || null,
          countyName: geo?.county_name || location.countyName || null,
          label: location.label,
        },
        recipient_location: {
          city: location.city || null,
          state: "MI",
        },
        sector_naics: null,
        psc_code: null,
        tech_tags: techTags,
        jobs_estimate: jobs,
        capex_estimate: amount,
        program_name: sourceName,
        award_type: "MEDC announcement",
        confidence_score: 80,
        provenance: {
          matchedEntityStrategy: "medc_press_release_company_parse",
          matchedFacilityStrategy: geoId ? "michigan_county_match" : "michigan_state_or_city_only",
          notes: ["Official MEDC strategic project announcement parsed from public press release."],
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
        dataset: "michigan_medc_project_announcements",
        evidence_type: "state_incentive_announced",
        observed_at: observedAt,
        source_url: page.url,
        confidence_score: 84,
        raw_payload: {
          title: entry.title,
          description: entry.description,
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
        id: deterministicUuid(`facility-event:mi-projects:${sourceNaturalId}`),
        facility_id: facilityId,
        event_type: "state_incentive_announced",
        occurred_at: observedAt,
        signal_id: signalId,
        metadata: {
          location_label: location.label,
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:mi-projects:${sourceNaturalId}`),
        source_record_id: sourceRecordId,
        entity_id: companyId,
        facility_id: facilityId,
        decision_type: "deterministic",
        score: "0.8400",
        features: {
          exactIdentifiers: [],
          nameSimilarity: 1,
          sectorAlignment: true,
        },
        candidate_set: [companyId, facilityId],
        chosen: true,
        rationale: "Resolved from official Michigan MEDC strategic project announcement.",
      });
    }
  }

  return bundle;
}
