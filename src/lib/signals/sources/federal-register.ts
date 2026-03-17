import type { Signal } from "../types";
import { computeOtRelevanceScore, extractTextForScoring } from "../ot-relevance";

const OT_SEARCH_TERMS = [
  "SCADA",
  "industrial control",
  "critical infrastructure",
  "cybersecurity",
  "operational technology",
  "pipeline safety",
  "chemical facility",
  "nuclear",
  "manufacturing",
  "water treatment",
  "electric grid",
  "NERC CIP",
  "ISA 62443",
];

const AGENCY_SECTOR_MAP: [string, Signal["sector"]][] = [
  ["department of defense", "defense"],
  ["department of the army", "defense"],
  ["department of the navy", "defense"],
  ["department of the air force", "defense"],
  ["defense logistics agency", "defense"],
  ["defense advanced research projects", "defense"],
  ["missile defense agency", "defense"],
  ["cybersecurity and infrastructure security", "defense"],
  ["department of homeland security", "defense"],
  ["department of energy", "energy"],
  ["federal energy regulatory commission", "energy"],
  ["nuclear regulatory commission", "nuclear"],
  ["national nuclear security administration", "nuclear"],
  ["environmental protection agency", "chemical"],
  ["food and drug administration", "pharma"],
  ["department of health and human services", "pharma"],
  ["national institutes of health", "life-sciences"],
  ["pipeline and hazardous materials safety", "oil-gas"],
  ["bureau of ocean energy management", "oil-gas"],
  ["bureau of safety and environmental enforcement", "oil-gas"],
  ["national aeronautics and space administration", "aerospace"],
  ["federal aviation administration", "aerospace"],
  ["bureau of reclamation", "water"],
  ["army corps of engineers", "water"],
  ["mine safety and health administration", "critical-minerals"],
  ["bureau of land management", "critical-minerals"],
];

const SECTOR_KEYWORDS: [RegExp, Signal["sector"]][] = [
  [/\b(missile|military|dod|darpa|army|navy|air\s*force|marine corps|combat|munition|weapon)\b/i, "defense"],
  [/\b(aerospace|nasa|aviation|faa|spacecraft|satellite|rocket)\b/i, "aerospace"],
  [/\b(nuclear|nrc|reactor|uranium|enrichment|fission|isotope)\b/i, "nuclear"],
  [/\b(semiconductor|chip\s*fab|wafer|tsmc|intel\s+corp|micron|foundry|lithography|chips\s+act)\b/i, "semiconductor"],
  [/\b(data\s*center|hyperscale|cloud\s+infrastructure|server\s*farm|colocation)\b/i, "data-center"],
  [/\b(energy|electric|utility|grid|power\s*plant|solar|wind|ferc|turbine|substation|generator)\b/i, "energy"],
  [/\b(pipeline|oil|petroleum|refinery|lng|natural\s*gas|drilling|crude)\b/i, "oil-gas"],
  [/\b(pharmac|drug\b|fda|biotech|clinical\s*trial|gxp|biologic)\b/i, "pharma"],
  [/\b(life.?science|medical\s*device|diagnostic)\b/i, "life-sciences"],
  [/\b(chemical|hazardous|toxic|pfas|pesticide)\b/i, "chemical"],
  [/\b(water|wastewater|treatment\s*plant|reservoir|desalination|potable|drinking\s+water)\b/i, "water"],
  [/\b(battery|lithium|cathode|anode|ev\s+battery|gigafactory|cell\s+manufacturing)\b/i, "ev-battery"],
  [/\b(mining|mineral|rare\s*earth|critical\s*mineral|cobalt|nickel\s+ore)\b/i, "critical-minerals"],
];

function inferSector(agencies: string[], text: string): Signal["sector"] {
  const agenciesLower = agencies.map((a) => a.toLowerCase());
  for (const [key, sector] of AGENCY_SECTOR_MAP) {
    for (const a of agenciesLower) {
      if (a.includes(key)) return sector;
    }
  }

  for (const [pattern, sector] of SECTOR_KEYWORDS) {
    if (pattern.test(text)) return sector;
  }

  return "manufacturing";
}

function docTypeToSignalType(type: string): Signal["signalType"] {
  switch (type) {
    case "Rule": return "regulatory-action";
    case "Proposed Rule": return "regulatory-action";
    case "Notice": return "regulatory-action";
    case "Presidential Document": return "regulatory-action";
    default: return "regulatory-action";
  }
}

interface FRDocument {
  document_number: string;
  title: string;
  type: string;
  abstract?: string;
  agencies: { name: string; raw_name: string }[];
  publication_date: string;
  html_url: string;
  body_html_url?: string;
  action?: string;
  dates?: string;
  docket_ids?: string[];
  page_length?: number;
  excerpts?: string;
}

export async function fetchFederalRegisterSignals(): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const term of OT_SEARCH_TERMS) {
    try {
      const params = new URLSearchParams({
        "conditions[term]": term,
        "conditions[publication_date][gte]": getDateDaysAgo(90),
        per_page: "20",
        order: "newest",
      });

      const res = await fetch(
        `https://www.federalregister.gov/api/v1/documents.json?${params}`,
        { headers: { Accept: "application/json" } }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const results = (data.results || []) as FRDocument[];

      for (const doc of results) {
        const id = `federal-register-${doc.document_number}`;
        if (signals.some((s) => s.id === id)) continue;

        const agencies = doc.agencies.map((a) => a.name || a.raw_name);
        const fullText = extractTextForScoring(
          doc as unknown as Record<string, unknown>,
          doc.abstract || doc.title,
          [...agencies, doc.action || ""]
        );
        const { score, keywords } = computeOtRelevanceScore(fullText);

        signals.push({
          id,
          source: "federal-register",
          sourceId: doc.document_number,
          timestamp: new Date(doc.publication_date).toISOString(),
          entity: agencies[0] || "Federal Government",
          sector: inferSector(agencies, fullText),
          signalType: docTypeToSignalType(doc.type),
          location: "United States",
          value: 0,
          description: (doc.abstract || doc.title).slice(0, 2000),
          url: doc.html_url,
          otRelevanceScore: score,
          otKeywords: keywords,
          rawData: {
            document_number: doc.document_number,
            type: doc.type,
            agencies,
            action: doc.action,
            docket_ids: doc.docket_ids,
          },
        });
      }
    } catch {
      // continue on individual term failure
    }
  }

  return signals;
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
