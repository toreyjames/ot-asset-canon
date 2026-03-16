import type { Signal } from "../types";
import { computeOtRelevanceScore, extractTextForScoring } from "../ot-relevance";

const OT_SEARCH_TERMS = [
  "SCADA",
  "industrial control system",
  "cybersecurity",
  "operational technology",
  "control system integration",
  "automation",
  "PLC programming",
  "DCS",
  "manufacturing",
  "critical infrastructure",
];

interface SamOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  department?: string;
  subTier?: string;
  type?: string;
  postedDate: string;
  responseDeadLine?: string;
  naicsCode?: string;
  classificationCode?: string;
  description?: string;
  organizationType?: string;
  uiLink?: string;
  placeOfPerformance?: {
    city?: { name?: string };
    state?: { code?: string; name?: string };
    country?: { code?: string };
  };
}

function inferSector(naics: string | null, text: string): Signal["sector"] {
  const lower = text.toLowerCase();
  if (naics) {
    const prefix = naics.slice(0, 3);
    if (prefix === "336") return "defense";
    if (prefix === "334") return "semiconductor";
    if (prefix === "325") return "chemical";
    if (prefix === "221") return "energy";
    if (prefix === "541") return "defense";
  }
  if (lower.includes("defense") || lower.includes("military") || lower.includes("dod")) return "defense";
  if (lower.includes("nuclear")) return "nuclear";
  if (lower.includes("energy") || lower.includes("electric")) return "energy";
  if (lower.includes("pharma") || lower.includes("fda")) return "pharma";
  return "manufacturing";
}

function typeToSignalType(type: string | undefined): Signal["signalType"] {
  if (!type) return "rfp";
  const lower = type.toLowerCase();
  if (lower.includes("award")) return "contract-award";
  if (lower.includes("modification") || lower.includes("mod")) return "modification";
  if (lower.includes("presol") || lower.includes("source")) return "rfp";
  return "rfp";
}

export async function fetchSamGovSignals(): Promise<Signal[]> {
  const signals: Signal[] = [];
  const apiKey = process.env.SAM_GOV_API_KEY;

  if (!apiKey) {
    // Fallback: use the public SAM.gov search page data via the opendata endpoint
    return fetchSamGovPublicOpportunities();
  }

  for (const term of OT_SEARCH_TERMS.slice(0, 5)) {
    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        q: term,
        postedFrom: getDateDaysAgo(60),
        postedTo: new Date().toISOString().split("T")[0],
        limit: "25",
      });

      const res = await fetch(
        `https://api.sam.gov/opportunities/v2/search?${params}`,
        { headers: { Accept: "application/json" } }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const opps = (data.opportunitiesData || []) as SamOpportunity[];

      for (const opp of opps) {
        const id = `sam-gov-${opp.noticeId}`;
        if (signals.some((s) => s.id === id)) continue;

        const description = opp.description || opp.title;
        const fullText = extractTextForScoring(
          opp as unknown as Record<string, unknown>,
          description,
          [opp.department, opp.subTier, opp.naicsCode]
        );
        const { score, keywords } = computeOtRelevanceScore(fullText);

        const pop = opp.placeOfPerformance;
        const city = pop?.city?.name || "";
        const state = pop?.state?.code || pop?.state?.name || "";
        const location = city && state ? `${city}, ${state}` : state || "United States";

        signals.push({
          id,
          source: "sam.gov",
          sourceId: opp.solicitationNumber || opp.noticeId,
          timestamp: new Date(opp.postedDate).toISOString(),
          entity: opp.department || opp.fullParentPathName || "Federal Government",
          sector: inferSector(opp.naicsCode || null, fullText),
          signalType: typeToSignalType(opp.type),
          location,
          value: 0,
          description: description.slice(0, 2000),
          url: opp.uiLink || `https://sam.gov/opp/${opp.noticeId}/view`,
          otRelevanceScore: score,
          otKeywords: keywords,
          rawData: {
            notice_id: opp.noticeId,
            solicitation_number: opp.solicitationNumber,
            type: opp.type,
            naics: opp.naicsCode,
            classification_code: opp.classificationCode,
            department: opp.department,
          },
        });
      }

      await sleep(300);
    } catch {
      // continue
    }
  }

  return signals;
}

async function fetchSamGovPublicOpportunities(): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const term of OT_SEARCH_TERMS.slice(0, 6)) {
    try {
      const params = new URLSearchParams({
        q: term,
        index: "opp",
        page: "0",
        sort: "-modifiedDate",
        size: "25",
        mode: "search",
        is_active: "true",
      });

      const res = await fetch(
        `https://sam.gov/api/prod/sgs/v1/search/?${params}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "OTRadar/1.0",
          },
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const results = data?._embedded?.results || [];

      for (const result of results) {
        const id = `sam-gov-${result._id || result.noticeId}`;
        if (signals.some((s) => s.id === id)) continue;

        const title = result.title || result._source?.title || "Untitled";
        const description = result.description || title;

        const fullText = extractTextForScoring(
          result as Record<string, unknown>,
          description,
          [title]
        );
        const { score, keywords } = computeOtRelevanceScore(fullText);

        signals.push({
          id,
          source: "sam.gov",
          sourceId: result.solicitationNumber || result._id || "",
          timestamp: new Date(result.modifiedDate || result.postedDate || Date.now()).toISOString(),
          entity: result.organizationHierarchy?.[0]?.name || result.department || "Federal Government",
          sector: "defense",
          signalType: "rfp",
          location: result.placeOfPerformance?.state || "United States",
          value: 0,
          description: title.slice(0, 2000),
          url: `https://sam.gov/opp/${result._id || result.noticeId}/view`,
          otRelevanceScore: score,
          otKeywords: keywords,
          rawData: { title, type: result.type },
        });
      }

      await sleep(500);
    } catch {
      // continue
    }
  }

  return signals;
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
