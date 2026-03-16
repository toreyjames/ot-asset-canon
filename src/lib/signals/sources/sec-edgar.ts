import type { Signal } from "../types";
import { computeOtRelevanceScore, extractTextForScoring } from "../ot-relevance";

const SEARCH_QUERIES = [
  "SCADA cybersecurity",
  "industrial control systems",
  "operational technology security",
  "OT cybersecurity",
  "critical infrastructure cyber",
  "manufacturing automation",
  "pipeline SCADA",
  "smart factory",
  "ICS security",
  "process control systems",
];

const USER_AGENT = "OTRadar/1.0 contact@aibaseload.com";

interface EFTSResult {
  id: string;
  entity_name: string;
  file_date: string;
  period_of_report?: string;
  form_type: string;
  file_num?: string;
  file_description?: string;
  _highlights?: Record<string, string[]>;
}

function formTypeToSignalType(formType: string): Signal["signalType"] {
  const ft = formType.toUpperCase();
  if (ft.includes("10-K") || ft.includes("10-Q")) return "capex-disclosure";
  if (ft.includes("8-K")) return "risk-disclosure";
  if (ft.includes("S-1") || ft.includes("S-3")) return "capex-disclosure";
  if (ft.includes("DEF 14A")) return "capex-disclosure";
  return "risk-disclosure";
}

function inferSector(entityName: string, text: string): Signal["sector"] {
  const lower = (entityName + " " + text).toLowerCase();
  if (lower.includes("defense") || lower.includes("raytheon") || lower.includes("lockheed") || lower.includes("northrop") || lower.includes("l3harris") || lower.includes("bae systems")) return "defense";
  if (lower.includes("aerospace") || lower.includes("boeing") || lower.includes("ge aerospace")) return "aerospace";
  if (lower.includes("nuclear") || lower.includes("nuscale") || lower.includes("constellation energy")) return "nuclear";
  if (lower.includes("semiconductor") || lower.includes("intel") || lower.includes("tsmc") || lower.includes("micron") || lower.includes("texas instruments")) return "semiconductor";
  if (lower.includes("pharma") || lower.includes("pfizer") || lower.includes("merck") || lower.includes("johnson") || lower.includes("abbott")) return "pharma";
  if (lower.includes("energy") || lower.includes("exxon") || lower.includes("chevron") || lower.includes("duke energy") || lower.includes("southern company")) return "energy";
  if (lower.includes("chemical") || lower.includes("dow") || lower.includes("basf") || lower.includes("dupont") || lower.includes("3m")) return "chemical";
  if (lower.includes("water") || lower.includes("xylem") || lower.includes("veolia")) return "water";
  if (lower.includes("oil") || lower.includes("gas") || lower.includes("pipeline") || lower.includes("halliburton")) return "oil-gas";
  return "manufacturing";
}

export async function fetchSecEdgarSignals(): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const query of SEARCH_QUERIES) {
    try {
      const params = new URLSearchParams({
        q: query,
        dateRange: "custom",
        startdt: getDateDaysAgo(180),
        enddt: new Date().toISOString().split("T")[0],
        forms: "10-K,10-Q,8-K",
      });

      const res = await fetch(
        `https://efts.sec.gov/LATEST/search-index?${params}`,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const hits = (data.hits?.hits || []) as { _id: string; _source: EFTSResult }[];

      for (const hit of hits.slice(0, 15)) {
        const doc = hit._source;
        const id = `sec-edgar-${doc.id || hit._id}`;
        if (signals.some((s) => s.id === id)) continue;

        const highlights = Object.values(doc._highlights || {})
          .flat()
          .join(" ")
          .replace(/<[^>]+>/g, "");
        const fullText = extractTextForScoring(
          doc as unknown as Record<string, unknown>,
          highlights || doc.file_description || doc.form_type,
          [doc.entity_name]
        );
        const { score, keywords } = computeOtRelevanceScore(fullText);

        signals.push({
          id,
          source: "sec-edgar",
          sourceId: doc.id || hit._id,
          timestamp: new Date(doc.file_date).toISOString(),
          entity: doc.entity_name,
          sector: inferSector(doc.entity_name, fullText),
          signalType: formTypeToSignalType(doc.form_type),
          location: "United States",
          value: 0,
          description: (
            doc.file_description ||
            `${doc.form_type} filing by ${doc.entity_name}` +
            (highlights ? ` — ${highlights.slice(0, 300)}` : "")
          ).slice(0, 2000),
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(doc.entity_name)}&type=${doc.form_type}&dateb=&owner=include&count=10`,
          otRelevanceScore: score,
          otKeywords: keywords,
          rawData: {
            form_type: doc.form_type,
            file_date: doc.file_date,
            file_num: doc.file_num,
            period_of_report: doc.period_of_report,
          },
        });
      }

      // Respect SEC fair-access policy
      await sleep(200);
    } catch {
      // continue on individual query failure
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
