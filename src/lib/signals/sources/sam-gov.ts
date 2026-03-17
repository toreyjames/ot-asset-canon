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

const DEPT_SECTOR_MAP: [string, Signal["sector"]][] = [
  ["department of defense", "defense"],
  ["department of the army", "defense"],
  ["department of the navy", "defense"],
  ["department of the air force", "defense"],
  ["defense logistics agency", "defense"],
  ["defense information systems", "defense"],
  ["department of energy", "energy"],
  ["nuclear regulatory commission", "nuclear"],
  ["national nuclear security", "nuclear"],
  ["environmental protection agency", "chemical"],
  ["national aeronautics and space", "aerospace"],
  ["federal aviation administration", "aerospace"],
  ["food and drug administration", "pharma"],
  ["department of health and human services", "pharma"],
  ["pipeline and hazardous materials", "oil-gas"],
  ["bureau of ocean energy", "oil-gas"],
  ["federal energy regulatory commission", "energy"],
  ["bureau of reclamation", "water"],
];

const SECTOR_KEYWORDS: [RegExp, Signal["sector"]][] = [
  [/\b(missile|military|dod|darpa|army|navy|air\s*force|marine corps|combat|munition|weapon)\b/i, "defense"],
  [/\b(aerospace|nasa|aviation|faa|spacecraft|satellite|rocket)\b/i, "aerospace"],
  [/\b(nuclear|nrc|reactor|uranium|enrichment|fission)\b/i, "nuclear"],
  [/\b(semiconductor|chip\s*fab|wafer|tsmc|intel|micron|foundry|lithography)\b/i, "semiconductor"],
  [/\b(data\s*center|hyperscale|cloud\s+infrastructure|server\s*farm|colocation)\b/i, "data-center"],
  [/\b(energy|electric|utility|grid|power\s*plant|solar|wind|ferc|turbine|substation|generator)\b/i, "energy"],
  [/\b(pipeline|oil|petroleum|refinery|lng|natural\s*gas|drilling|crude)\b/i, "oil-gas"],
  [/\b(pharmac|drug\b|fda|biotech|clinical\s*trial|gxp|biologic)\b/i, "pharma"],
  [/\b(life.?science|medical\s*device|diagnostic)\b/i, "life-sciences"],
  [/\b(chemical|hazardous|toxic|pfas|pesticide)\b/i, "chemical"],
  [/\b(water|wastewater|treatment\s*plant|reservoir|desalination|potable)\b/i, "water"],
  [/\b(battery|lithium|cathode|anode|ev\s+battery|gigafactory)\b/i, "ev-battery"],
  [/\b(mining|mineral|rare\s*earth|critical\s*mineral|cobalt)\b/i, "critical-minerals"],
];

function inferSector(naics: string | null, text: string, department?: string): Signal["sector"] {
  if (department) {
    const deptLower = department.toLowerCase();
    for (const [key, sector] of DEPT_SECTOR_MAP) {
      if (deptLower.includes(key)) return sector;
    }
  }

  for (const [pattern, sector] of SECTOR_KEYWORDS) {
    if (pattern.test(text)) return sector;
  }

  if (naics) {
    const p3 = naics.slice(0, 3);
    const p4 = naics.slice(0, 4);
    if (p3 === "336") return "defense";
    if (p3 === "334") return "semiconductor";
    if (p4 === "3254") return "pharma";
    if (p3 === "325") return "chemical";
    if (p3 === "221") return "energy";
    if (p3 === "237") return "energy";
    if (p3 === "324") return "oil-gas";
    if (p3 === "541") return "defense";
  }

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
          sector: inferSector(opp.naicsCode || null, fullText, opp.department),
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
          sector: inferSector(null, `${title} ${result.description || ""}`, result.organizationHierarchy?.[0]?.name || result.department),
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
