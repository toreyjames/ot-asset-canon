import {
  buildGeoRow,
  deterministicUuid,
  emptyBundle,
  formatCountyFips,
  isoDate,
  mergeRowsById,
  normalizeName,
  readJsonSource,
  safeNumber,
  sha256,
} from "./common.mjs";

function buildGeoRowFromRecord(record, sourceName) {
  const stateCode = String(record.state || "").toUpperCase();
  if (!stateCode) return null;

  const countyFips =
    record.countyFips ||
    (record.countyCode ? formatCountyFips(stateCode, record.countyCode) : null);

  return buildGeoRow({
    countyFips: countyFips || null,
    stateCode,
    countyName: record.countyName || null,
    cbsaCode: record.cbsaCode || null,
    cbsaName: record.cbsaName || null,
    metadata: { source: sourceName },
  });
}

function sourceListFromValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeBundles(...bundles) {
  const merged = emptyBundle();

  for (const key of Object.keys(merged)) {
    merged[key] = mergeRowsById(...bundles.map((bundle) => bundle[key] || []));
  }

  return merged;
}

async function ingestSingleProjectFeed(source) {
  const payload = await readJsonSource(source);
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.records)
      ? payload.records
      : [];

  if (!Array.isArray(records)) {
    throw new Error("Project feed must be a JSON array or an object with a records array.");
  }

  const sourceName = payload.sourceName || "Industrial project feed";
  const bundle = emptyBundle();

  for (const record of records) {
    const companyName = record.companyName || record.recipientName || record.name;
    if (!companyName) continue;

    const companyId = deterministicUuid(`entity:project-feed:${normalizeName(companyName)}`);
    const facilityName = record.facilityName || record.projectName || companyName;
    const facilityKey = record.facilityId || `${normalizeName(facilityName)}:${record.city || ""}:${record.state || ""}`;
    const facilityId = deterministicUuid(`facility:project-feed:${facilityKey}`);
    const sourceRecordNaturalId = record.id || record.projectId || facilityKey;
    const sourceRecordId = deterministicUuid(`source:project-feed:${sourceRecordNaturalId}`);
    const geoRow = buildGeoRowFromRecord(record, sourceName);
    const geoId = geoRow?.id || null;
    const projectId = deterministicUuid(`project:project-feed:${sourceRecordNaturalId}`);
    const evidenceId = deterministicUuid(`evidence:project-feed:${sourceRecordNaturalId}`);
    const signalId = deterministicUuid(`signal:project-feed:${sourceRecordNaturalId}`);

    if (geoRow) bundle.geoRows.push(geoRow);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "company",
      country: "US",
      identifiers: {
        ...(record.cik ? { cik: String(record.cik).padStart(10, "0") } : {}),
        ...(record.uei ? { uei: record.uei } : {}),
        ...(record.ticker ? { tickers: [record.ticker] } : {}),
      },
      aliases: record.aliases || [],
      address: {
        city: record.city || undefined,
        state: record.state || undefined,
        postalCode: record.postalCode || undefined,
        countyFips: record.countyFips || undefined,
      },
      confidence_score: 82,
      metadata: {
        source: sourceName,
        ownershipType: record.ownershipType || "project_feed",
      },
    });

    bundle.facilityRows.push({
      id: facilityId,
      entity_id: companyId,
      geo_id: geoId,
      facility_name: facilityName,
      normalized_name: normalizeName(facilityName),
      address: {
        street1: record.street1 || undefined,
        city: record.city || undefined,
        state: record.state || undefined,
        postalCode: record.postalCode || undefined,
        countyFips: record.countyFips || undefined,
      },
      latitude: record.latitude ? String(record.latitude) : null,
      longitude: record.longitude ? String(record.longitude) : null,
      county_fips: record.countyFips || null,
      cbsa_code: record.cbsaCode || null,
      facility_source_ids: {},
      confidence_score: 80,
      metadata: {
        source: sourceName,
        ownershipType: record.ownershipType || "project_feed",
      },
    });

    bundle.sourceRows.push({
      id: sourceRecordId,
      source_system: sourceName,
      source_record_id: String(sourceRecordNaturalId),
      source_category: "incentive",
      source_url: record.sourceUrl || source,
      source_hash: sha256(JSON.stringify(record)),
      effective_date: isoDate(record.actionDate || record.announcementDate || record.updatedAt),
      raw_payload: record,
      extraction_version: "project-feed-v1",
    });

    bundle.projectRows.push({
      id: projectId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_type: record.projectType || "industrial_project",
      sector: record.sector || null,
      investment_amount:
        safeNumber(record.totalInvestmentAmount || record.amount || record.capexEstimate) ?? null,
      announcement_date: isoDate(record.announcementDate || record.actionDate),
      construction_start: isoDate(record.constructionStart),
      completion_estimate: isoDate(record.completionEstimate),
      status: record.status || "observed",
      metadata: {
        source: sourceName,
        jobsEstimate: record.jobsEstimate || null,
        ownershipType: record.ownershipType || "project_feed",
      },
    });

    if (safeNumber(record.amount || record.totalInvestmentAmount || record.capexEstimate) !== null) {
      bundle.investmentRows.push({
        id: deterministicUuid(`investment:project-feed:${sourceRecordNaturalId}`),
        source_record_id: sourceRecordId,
        provider_entity_id: null,
        recipient_entity_id: companyId,
        facility_id: facilityId,
        geo_id: geoId,
        taxonomy_id: null,
        event_type: record.eventType || "capex_announcement",
        amount: String(
          safeNumber(record.amount || record.totalInvestmentAmount || record.capexEstimate)
        ),
        amount_type: record.amountType || "estimate",
        currency: record.currency || "USD",
        announced_date: isoDate(record.announcementDate || record.actionDate),
        action_date: isoDate(record.actionDate || record.announcementDate),
        start_date: isoDate(record.constructionStart),
        end_date: isoDate(record.completionEstimate),
        provider_name: record.providerName || null,
        recipient_name: companyName,
        program_name: record.programName || null,
        award_type: record.awardType || null,
        sector_naics: record.sectorNaics || null,
        psc_code: null,
        tech_tags: record.techTags || [],
        jobs_estimate: safeNumber(record.jobsEstimate),
        capex_estimate: safeNumber(record.capexEstimate || record.amount || record.totalInvestmentAmount),
        county_fips: record.countyFips || null,
        cbsa_code: record.cbsaCode || null,
        place_of_performance: {
          city: record.city || null,
          state: record.state || null,
        },
        recipient_location: {
          city: record.city || null,
          state: record.state || null,
        },
        confidence_score: 80,
        provenance: {
          matchedEntityStrategy: "project_feed_company_name",
          matchedFacilityStrategy: "project_feed_facility_name",
        },
      });
    }

    bundle.evidenceRows.push({
      id: evidenceId,
      source_record_id: sourceRecordId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      source_name: sourceName,
      dataset: payload.dataset || "project_feed",
      evidence_type: record.evidenceType || "project_announcement_observed",
      source_url: record.sourceUrl || source,
      confidence_score: 78,
      observed_at: isoDate(record.actionDate || record.announcementDate || record.updatedAt) || new Date().toISOString(),
      raw_payload: record,
    });

    bundle.signalRows.push({
      id: signalId,
      facility_id: facilityId,
      company_id: companyId,
      geo_id: geoId,
      project_id: projectId,
      signal_type: record.signalType || "project_momentum_observed",
      value: record.status || record.projectType || "observed",
      unit: null,
      evidence_id: evidenceId,
      observed_at: isoDate(record.actionDate || record.announcementDate || record.updatedAt) || new Date().toISOString(),
      metadata: {
        source: sourceName,
        jobsEstimate: record.jobsEstimate || null,
      },
    });

    if (record.permitStatus || record.permitProgram || record.permitEventType) {
      bundle.permitRows.push({
        id: deterministicUuid(`permit:project-feed:${sourceRecordNaturalId}`),
        source_record_id: sourceRecordId,
        facility_id: facilityId,
        geo_id: geoId,
        responsible_entity_id: companyId,
        permit_or_project_id: String(record.projectId || sourceRecordNaturalId),
        event_type: record.permitEventType || "updated",
        event_date: isoDate(record.permitEventDate || record.actionDate || record.announcementDate) || new Date().toISOString(),
        responsible_agency: record.responsibleAgency || null,
        permit_program: record.permitProgram || null,
        status: record.permitStatus || null,
        county_fips: record.countyFips || null,
        cbsa_code: record.cbsaCode || null,
        notes: record.notes || null,
        metadata: record,
        confidence_score: 72,
      });
    }

    bundle.facilityEventRows.push({
      id: deterministicUuid(`facility-event:project-feed:${sourceRecordNaturalId}`),
      facility_id: facilityId,
      event_type: record.facilityEventType || "project_activity_observed",
      occurred_at: isoDate(record.actionDate || record.announcementDate || record.updatedAt) || new Date().toISOString(),
      signal_id: signalId,
      metadata: {
        source: sourceName,
        projectType: record.projectType || null,
      },
    });

    bundle.resolutionRows.push({
      id: deterministicUuid(`resolution:project-feed:${sourceRecordNaturalId}`),
      source_record_id: sourceRecordId,
      entity_id: companyId,
      facility_id: facilityId,
      decision_type: "composite",
      score: "0.8500",
      features: {
        exactIdentifiers: [],
        nameSimilarity: 1,
        addressMatch: record.city && record.state ? 0.7 : 0.2,
        sectorAlignment: Boolean(record.sector || record.sectorNaics),
      },
      candidate_set: [facilityId],
      chosen: true,
      rationale: "Matched from structured project feed company and facility fields.",
    });
  }

  return bundle;
}

export async function ingestProjectFeed(config = {}) {
  const sources = sourceListFromValue(config.source || process.env.INDUSTRIAL_TRACKER_PROJECT_FEED);
  if (!sources.length) {
    throw new Error("INDUSTRIAL_TRACKER_PROJECT_FEED is not configured.");
  }

  const bundles = [];
  for (const source of sources) {
    bundles.push(await ingestSingleProjectFeed(source));
  }

  return mergeBundles(...bundles);
}
