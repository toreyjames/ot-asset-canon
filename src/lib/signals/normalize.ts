import type { Signal, SignalSource, SignalSector, SignalType } from "./types";
import { VALID_SOURCES, VALID_SECTORS, VALID_SIGNAL_TYPES } from "./types";
import { computeOtRelevanceScore, extractTextForScoring } from "./ot-relevance";

interface SourceRecordRow {
  id: string;
  sourceSystem: string;
  sourceRecordId: string;
  sourceUrl: string | null;
  effectiveDate: Date | null;
  fetchedAt: Date;
  rawPayload: Record<string, unknown>;
}

interface InvestmentEventRow {
  id: string;
  eventType: string;
  amount: string | null;
  recipientName: string | null;
  providerName: string | null;
  programName: string | null;
  sectorNaics: string | null;
  techTags: string[];
  actionDate: Date | null;
  announcedDate: Date | null;
  placeOfPerformance: Record<string, unknown> | null;
  recipientLocation: Record<string, unknown> | null;
  countyFips: string | null;
  sourceRecord: SourceRecordRow;
}

interface PermitEventRow {
  id: string;
  eventType: string;
  eventDate: Date;
  permitProgram: string | null;
  status: string | null;
  notes: string | null;
  countyFips: string | null;
  responsibleAgency: string | null;
  metadata: Record<string, unknown> | null;
  sourceRecord: SourceRecordRow;
}

interface EvidenceRecordRow {
  id: string;
  sourceName: string;
  dataset: string;
  evidenceType: string;
  sourceUrl: string | null;
  observedAt: Date;
  rawPayload: Record<string, unknown>;
  confidenceScore: number | null;
}

function mapSourceSystem(raw: string): SignalSource {
  const lower = raw.toLowerCase();
  if (lower.includes("sam") || lower.includes("sam.gov")) return "sam.gov";
  if (lower.includes("usaspending")) return "usaspending";
  if (lower.includes("fpds")) return "fpds";
  if (lower.includes("epa") || lower.includes("echo") || lower.includes("frs")) return "epa";
  if (lower.includes("sec") || lower.includes("edgar")) return "sec-edgar";
  if (lower.includes("eia")) return "eia";
  if (lower.includes("fred")) return "fred";
  if (lower.includes("fda")) return "fda";
  if (lower.includes("federal register") || lower.includes("federal-register")) return "federal-register";
  if (lower.includes("news") || lower.includes("rss")) return "news-rss";
  for (const s of VALID_SOURCES) {
    if (lower.includes(s)) return s;
  }
  return "sam.gov";
}

function naicsToSector(naics: string | null, techTags: string[]): SignalSector {
  const tags = techTags.map((t) => t.toLowerCase()).join(" ");
  const code = naics || "";
  const prefix2 = code.slice(0, 2);
  const prefix3 = code.slice(0, 3);

  if (tags.includes("semiconductor") || prefix3 === "334") return "semiconductor";
  if (tags.includes("nuclear") || prefix3 === "221") return "nuclear";
  if (tags.includes("pharma") || prefix3 === "325") return "pharma";
  if (tags.includes("defense") || prefix3 === "336") return "defense";
  if (tags.includes("aerospace")) return "aerospace";
  if (tags.includes("data center") || tags.includes("data-center")) return "data-center";
  if (tags.includes("ev") || tags.includes("battery") || tags.includes("ev-battery")) return "ev-battery";
  if (tags.includes("chemical")) return "chemical";
  if (tags.includes("mineral") || tags.includes("mining")) return "critical-minerals";
  if (tags.includes("water")) return "water";
  if (tags.includes("oil") || tags.includes("gas") || tags.includes("petroleum")) return "oil-gas";
  if (tags.includes("energy") || tags.includes("power")) return "energy";

  if (prefix2 === "33") return "manufacturing";
  if (prefix2 === "32") return "manufacturing";
  if (prefix2 === "31") return "manufacturing";
  if (prefix2 === "21") return "critical-minerals";
  if (prefix2 === "22") return "energy";
  if (prefix2 === "48" || prefix2 === "49") return "manufacturing";

  if (tags.includes("life") || tags.includes("bio")) return "life-sciences";

  return "manufacturing";
}

function eventTypeToSignalType(eventType: string): SignalType {
  const lower = eventType.toLowerCase();
  if (lower.includes("opportunity") || lower.includes("solicitation") || lower === "rfp") return "rfp";
  if (lower.includes("award") || lower.includes("obligation")) return "contract-award";
  if (lower.includes("permit") || lower.includes("filed") || lower.includes("issued")) return "facility-permit";
  if (lower.includes("enforcement") || lower.includes("violation")) return "enforcement";
  if (lower.includes("capex") || lower.includes("capital") || lower.includes("disclosure")) return "capex-disclosure";
  if (lower.includes("cyber") || lower.includes("incident")) return "cyber-incident";
  if (lower.includes("funding") || lower.includes("financing") || lower.includes("grant")) return "funding-flow";
  if (lower.includes("expansion") || lower.includes("construction")) return "expansion";
  if (lower.includes("regulatory") || lower.includes("rule") || lower.includes("regulation")) return "regulatory-action";
  if (lower.includes("risk")) return "risk-disclosure";
  if (lower.includes("inspection") || lower.includes("audit")) return "inspection";
  if (lower.includes("modif") || lower.includes("amendment") || lower.includes("change")) return "modification";
  if (lower.includes("milestone")) return "expansion";
  return "contract-award";
}

function extractLocation(
  placeOfPerformance: Record<string, unknown> | null,
  recipientLocation: Record<string, unknown> | null,
  countyFips: string | null
): string {
  const pop = placeOfPerformance || {};
  const loc = recipientLocation || {};

  const state =
    (pop.state_code as string) ||
    (pop.state_name as string) ||
    (loc.state_code as string) ||
    (loc.state_name as string) ||
    "";
  const city =
    (pop.city_name as string) ||
    (loc.city_name as string) ||
    "";

  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  if (countyFips) return `FIPS:${countyFips}`;
  return "United States";
}

function extractDescription(raw: Record<string, unknown>, fallback: string): string {
  for (const key of ["description", "award_description", "title", "project_title", "summary", "abstract", "solicitation_title"]) {
    if (typeof raw[key] === "string" && (raw[key] as string).length > 5) {
      return raw[key] as string;
    }
  }
  return fallback;
}

function isValidSector(val: string): val is SignalSector {
  return (VALID_SECTORS as readonly string[]).includes(val);
}

function isValidSignalType(val: string): val is SignalType {
  return (VALID_SIGNAL_TYPES as readonly string[]).includes(val);
}

export function normalizeInvestmentEvent(row: InvestmentEventRow): Signal {
  const source = mapSourceSystem(row.sourceRecord.sourceSystem);
  const sector = naicsToSector(row.sectorNaics, row.techTags);
  const signalType = eventTypeToSignalType(row.eventType);
  const location = extractLocation(
    row.placeOfPerformance,
    row.recipientLocation,
    row.countyFips
  );
  const description = extractDescription(
    row.sourceRecord.rawPayload,
    row.programName || row.eventType
  );

  const text = extractTextForScoring(
    row.sourceRecord.rawPayload,
    description,
    [row.recipientName, row.providerName, row.programName, ...(row.techTags || [])]
  );
  const { score, keywords } = computeOtRelevanceScore(text);

  return {
    id: `${source.replace(".", "-")}-${row.sourceRecord.sourceRecordId}`,
    source,
    sourceId: row.sourceRecord.sourceRecordId,
    timestamp: (row.actionDate || row.announcedDate || row.sourceRecord.effectiveDate || row.sourceRecord.fetchedAt).toISOString(),
    entity: row.recipientName || row.providerName || "Unknown",
    sector,
    signalType,
    location,
    value: row.amount ? Math.round(parseFloat(row.amount)) : 0,
    description,
    url: row.sourceRecord.sourceUrl || "",
    otRelevanceScore: score,
    otKeywords: keywords,
    rawData: row.sourceRecord.rawPayload,
  };
}

export function normalizePermitEvent(row: PermitEventRow): Signal {
  const source = mapSourceSystem(row.sourceRecord.sourceSystem);
  const signalType = eventTypeToSignalType(row.eventType);
  const description = row.notes || extractDescription(
    row.sourceRecord.rawPayload,
    row.permitProgram || row.eventType
  );

  const text = extractTextForScoring(
    row.sourceRecord.rawPayload,
    description,
    [row.responsibleAgency, row.permitProgram]
  );
  const { score, keywords } = computeOtRelevanceScore(text);

  return {
    id: `${source.replace(".", "-")}-${row.sourceRecord.sourceRecordId}`,
    source,
    sourceId: row.sourceRecord.sourceRecordId,
    timestamp: row.eventDate.toISOString(),
    entity: row.responsibleAgency || "Unknown",
    sector: "manufacturing",
    signalType,
    location: row.countyFips ? `FIPS:${row.countyFips}` : "United States",
    value: 0,
    description,
    url: row.sourceRecord.sourceUrl || "",
    otRelevanceScore: score,
    otKeywords: keywords,
    rawData: row.sourceRecord.rawPayload,
  };
}

export function normalizeEvidenceRecord(row: EvidenceRecordRow): Signal {
  const source = mapSourceSystem(row.sourceName);
  const signalType = eventTypeToSignalType(row.evidenceType);
  const description = extractDescription(row.rawPayload, row.evidenceType);

  const text = extractTextForScoring(row.rawPayload, description, [row.dataset]);
  const { score, keywords } = computeOtRelevanceScore(text);

  return {
    id: `evidence-${row.id.slice(0, 8)}`,
    source,
    sourceId: row.id,
    timestamp: row.observedAt.toISOString(),
    entity: (row.rawPayload.entity_name as string) || (row.rawPayload.company as string) || "Unknown",
    sector: "manufacturing",
    signalType,
    location: (row.rawPayload.state as string) || "United States",
    value: 0,
    description,
    url: row.sourceUrl || "",
    otRelevanceScore: score,
    otKeywords: keywords,
    rawData: row.rawPayload,
  };
}

export function applyFilters(
  signals: Signal[],
  params: {
    sector?: string[];
    since?: string;
    signalType?: string[];
    minRelevance?: number;
    limit?: number;
  }
): { filtered: Signal[]; total: number } {
  const total = signals.length;
  let result = signals;

  if (params.sector?.length) {
    const valid = params.sector.filter(isValidSector);
    if (valid.length) {
      result = result.filter((s) => valid.includes(s.sector));
    }
  }

  if (params.since) {
    const since = new Date(params.since);
    if (!isNaN(since.getTime())) {
      result = result.filter((s) => new Date(s.timestamp) >= since);
    }
  }

  if (params.signalType?.length) {
    const valid = params.signalType.filter(isValidSignalType);
    if (valid.length) {
      result = result.filter((s) => valid.includes(s.signalType));
    }
  }

  if (params.minRelevance !== undefined && params.minRelevance > 0) {
    result = result.filter((s) => s.otRelevanceScore >= params.minRelevance!);
  }

  result.sort((a, b) => b.otRelevanceScore - a.otRelevanceScore);

  if (params.limit && params.limit > 0) {
    result = result.slice(0, params.limit);
  }

  return { filtered: result, total };
}
