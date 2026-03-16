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

const SECTOR_MAP: Record<string, Signal["sector"]> = {
  "Department of Defense": "defense",
  "Department of Energy": "energy",
  "Nuclear Regulatory Commission": "nuclear",
  "Environmental Protection Agency": "chemical",
  "Department of Homeland Security": "defense",
  "Food and Drug Administration": "pharma",
  "Pipeline and Hazardous Materials Safety Administration": "oil-gas",
  "Federal Energy Regulatory Commission": "energy",
  "Cybersecurity and Infrastructure Security Agency": "defense",
};

function inferSector(agencies: string[], text: string): Signal["sector"] {
  for (const agency of agencies) {
    for (const [key, sector] of Object.entries(SECTOR_MAP)) {
      if (agency.toLowerCase().includes(key.toLowerCase())) return sector;
    }
  }
  const lower = text.toLowerCase();
  if (lower.includes("nuclear")) return "nuclear";
  if (lower.includes("semiconductor") || lower.includes("chips")) return "semiconductor";
  if (lower.includes("pharma") || lower.includes("drug") || lower.includes("fda")) return "pharma";
  if (lower.includes("pipeline") || lower.includes("oil") || lower.includes("gas")) return "oil-gas";
  if (lower.includes("energy") || lower.includes("electric") || lower.includes("grid")) return "energy";
  if (lower.includes("water") || lower.includes("wastewater")) return "water";
  if (lower.includes("chemical")) return "chemical";
  if (lower.includes("defense") || lower.includes("military")) return "defense";
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
