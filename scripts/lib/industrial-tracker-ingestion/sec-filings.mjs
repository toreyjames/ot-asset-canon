import {
  deterministicUuid,
  emptyBundle,
  normalizeName,
  readIntEnv,
  readListEnv,
  sha256,
} from "./common.mjs";

function normalizeCik(value) {
  return String(value || "").replace(/\D/g, "").padStart(10, "0");
}

async function secFetch(pathname) {
  const userAgent = process.env.SEC_USER_AGENT || "Baseload Industrial Tracker contact@aibaseload.com";
  const response = await fetch(`https://data.sec.gov${pathname}`, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`SEC request failed: ${response.status} ${pathname}`);
  }

  return response.json();
}

export async function ingestSecFilings(config = {}) {
  const ciks = (config.ciks || readListEnv("SEC_TRACKER_CIKS", []))
    .map(normalizeCik)
    .filter(Boolean);
  const filingLimit = config.limit || readIntEnv("SEC_FILING_LIMIT", 25);

  if (!ciks.length) {
    throw new Error("SEC_TRACKER_CIKS is not configured.");
  }

  const bundle = emptyBundle();

  for (const cik of ciks) {
    const submissions = await secFetch(`/submissions/CIK${cik}.json`);
    const companyName = submissions.name || submissions.entityName || cik;
    const companyId = deterministicUuid(`entity:sec:${cik}`);

    bundle.entityRows.push({
      id: companyId,
      legal_name: companyName,
      normalized_name: normalizeName(companyName),
      entity_type: "issuer",
      country: "US",
      website_domain: null,
      identifiers: {
        cik,
        tickers: submissions.tickers || [],
      },
      aliases: submissions.tickers || [],
      address: {
        city: submissions.addresses?.business?.city || undefined,
        state: submissions.addresses?.business?.stateOrCountry || undefined,
        postalCode: submissions.addresses?.business?.zipCode || undefined,
        country: submissions.addresses?.business?.stateOrCountry || undefined,
      },
      confidence_score: 90,
      metadata: {
        source: "SEC EDGAR",
        sic: submissions.sic || null,
        sicDescription: submissions.sicDescription || null,
      },
    });

    const recent = submissions.filings?.recent || {};
    const forms = recent.form || [];
    const filingDates = recent.filingDate || [];
    const accessionNumbers = recent.accessionNumber || [];
    const primaryDocuments = recent.primaryDocument || [];

    for (let index = 0; index < Math.min(forms.length, filingLimit); index += 1) {
      const form = forms[index];
      const filingDate = filingDates[index];
      const accessionNumber = accessionNumbers[index];
      const primaryDocument = primaryDocuments[index];
      const accessionCompact = String(accessionNumber || "").replace(/-/g, "");
      const sourceRecordId = deterministicUuid(`source:sec:${cik}:${accessionCompact}`);
      const sourceUrl =
        accessionCompact && primaryDocument
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionCompact}/${primaryDocument}`
          : `https://data.sec.gov/submissions/CIK${cik}.json`;

      bundle.sourceRows.push({
        id: sourceRecordId,
        source_system: "SEC EDGAR",
        source_record_id: accessionNumber || `${cik}:${index}`,
        source_category: "filing",
        source_url: sourceUrl,
        source_hash: sha256(JSON.stringify({ cik, accessionNumber, form, filingDate })),
        effective_date: filingDate ? new Date(filingDate).toISOString() : null,
        raw_payload: {
          cik,
          companyName,
          form,
          filingDate,
          accessionNumber,
          primaryDocument,
        },
        extraction_version: "sec-submissions-v1",
      });

      const evidenceId = deterministicUuid(`evidence:sec:${cik}:${accessionCompact}`);
      bundle.evidenceRows.push({
        id: evidenceId,
        source_record_id: sourceRecordId,
        facility_id: null,
        company_id: companyId,
        geo_id: null,
        project_id: null,
        source_name: "SEC EDGAR",
        dataset: "submissions",
        evidence_type: "issuer_disclosure_observed",
        source_url: sourceUrl,
        confidence_score: 84,
        observed_at: filingDate ? new Date(filingDate).toISOString() : new Date().toISOString(),
        raw_payload: {
          cik,
          form,
          filingDate,
          accessionNumber,
          primaryDocument,
        },
      });

      bundle.signalRows.push({
        id: deterministicUuid(`signal:sec:${cik}:${accessionCompact}`),
        facility_id: null,
        company_id: companyId,
        geo_id: null,
        project_id: null,
        signal_type: "issuer_filing_observed",
        value: form || "filing",
        unit: null,
        evidence_id: evidenceId,
        observed_at: filingDate ? new Date(filingDate).toISOString() : new Date().toISOString(),
        metadata: {
          source: "SEC EDGAR",
          accessionNumber,
        },
      });

      bundle.resolutionRows.push({
        id: deterministicUuid(`resolution:sec:${cik}:${accessionCompact}`),
        source_record_id: sourceRecordId,
        entity_id: companyId,
        facility_id: null,
        decision_type: "deterministic",
        score: "0.9800",
        features: {
          exactIdentifiers: ["cik"],
          nameSimilarity: 1,
          addressMatch: 0.5,
          sectorAlignment: Boolean(submissions.sic),
        },
        candidate_set: [companyId],
        chosen: true,
        rationale: "Matched issuer disclosure on SEC CIK.",
      });
    }
  }

  return bundle;
}
