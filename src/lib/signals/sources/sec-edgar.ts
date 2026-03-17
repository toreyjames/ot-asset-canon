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

const ENTITY_SECTOR_MAP: [RegExp, Signal["sector"]][] = [
  [/\b(raytheon|lockheed|northrop|l3harris|bae\s*systems|general\s*dynamics|leidos|booz\s*allen|caci|saic)\b/i, "defense"],
  [/\b(boeing|ge\s*aerospace|airbus|textron\s*aviation|spirit\s*aero|pratt\s*&?\s*whitney|rolls[\s-]royce)\b/i, "aerospace"],
  [/\b(nuscale|constellation\s*energy|centrus|bwx\s*technologies|cameco|uranium)\b/i, "nuclear"],
  [/\b(intel\b|tsmc|micron|texas\s*instruments|nvidia|amd|qualcomm|broadcom|applied\s*materials|lam\s*research|asml|kla\s*corp|globalfoundries|on\s*semiconductor|marvell)\b/i, "semiconductor"],
  [/\b(pfizer|merck|johnson\s*&|abbott|eli\s*lilly|amgen|gilead|moderna|astrazeneca|novartis|bristol[\s-]myers|roche)\b/i, "pharma"],
  [/\b(exxon|chevron|conocophillips|marathon\s*petroleum|valero|phillips\s*66|halliburton|schlumberger|baker\s*hughes|occidental|pioneer\s*natural|devon\s*energy)\b/i, "oil-gas"],
  [/\b(duke\s*energy|southern\s*company|nextera|dominion|aes\s*corp|entergy|exelon|xcel\s*energy|first\s*energy|pacific\s*gas|edison\s*international)\b/i, "energy"],
  [/\b(dow\s*inc|dow\s*chemical|basf|dupont|3m\s*company|eastman\s*chemical|lyondellbasell|huntsman|celanese|westlake|olin\s*corp)\b/i, "chemical"],
  [/\b(xylem|veolia|american\s*water|essential\s*utilities|mueller\s*water|evoqua)\b/i, "water"],
  [/\b(albemarle|livent|piedmont\s*lithium|lithium\s*americas|mp\s*materials|freeport[\s-]mcmoran)\b/i, "critical-minerals"],
  [/\b(panasonic\s*energy|quantumscape|solid\s*power|enovix|freyr|li[\s-]cycle)\b/i, "ev-battery"],
  [/\b(equinix|digital\s*realty|cyrusone|qts\s*realty|coresite|iron\s*mountain.*data)\b/i, "data-center"],
];

const SECTOR_KEYWORDS: [RegExp, Signal["sector"]][] = [
  [/\b(missile|military|dod|darpa|army|navy|air\s*force|marine corps|combat|munition|weapon|defense\s+contract)\b/i, "defense"],
  [/\b(aerospace|nasa|aviation|faa|spacecraft|satellite|rocket)\b/i, "aerospace"],
  [/\b(nuclear|nrc|reactor|uranium|enrichment|fission|isotope)\b/i, "nuclear"],
  [/\b(semiconductor|chip\s*fab|wafer|foundry|lithography|chips\s+act|integrated\s+circuit)\b/i, "semiconductor"],
  [/\b(data\s*center|hyperscale|cloud\s+infrastructure|server\s*farm|colocation)\b/i, "data-center"],
  [/\b(energy|electric\s+util|utility|grid|power\s*plant|solar|wind|ferc|turbine|substation|generator)\b/i, "energy"],
  [/\b(pipeline|oil\s+and\s+gas|petroleum|refinery|lng|natural\s*gas|drilling|crude|offshore\s+platform)\b/i, "oil-gas"],
  [/\b(pharmac|drug\b|fda|biotech|clinical\s*trial|gxp|biologic)\b/i, "pharma"],
  [/\b(life.?science|medical\s*device|diagnostic)\b/i, "life-sciences"],
  [/\b(chemical|hazardous|toxic|pfas|pesticide|industrial\s+chemical)\b/i, "chemical"],
  [/\b(water|wastewater|treatment\s*plant|reservoir|desalination|potable)\b/i, "water"],
  [/\b(battery|lithium|cathode|anode|ev\s+battery|gigafactory|cell\s+manufacturing)\b/i, "ev-battery"],
  [/\b(mining|mineral|rare\s*earth|critical\s*mineral|cobalt)\b/i, "critical-minerals"],
];

function inferSector(entityName: string, text: string): Signal["sector"] {
  const combined = `${entityName} ${text}`;

  for (const [pattern, sector] of ENTITY_SECTOR_MAP) {
    if (pattern.test(entityName)) return sector;
  }

  for (const [pattern, sector] of SECTOR_KEYWORDS) {
    if (pattern.test(combined)) return sector;
  }

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
