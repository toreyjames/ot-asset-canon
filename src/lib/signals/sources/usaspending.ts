import type { Signal } from "../types";
import { computeOtRelevanceScore, extractTextForScoring } from "../ot-relevance";

const OT_KEYWORDS_FILTER = [
  "SCADA",
  "cybersecurity",
  "industrial control",
  "operational technology",
  "critical infrastructure",
  "control system",
  "automation",
  "manufacturing",
  "ICS",
  "PLC",
];

const OT_PSC_CODES = [
  "D399", "D316", "D317", "D318", "D319", "D302",
  "7035", "7042", "7050",
  "5895", "5820", "5821",
  "4920", "4930",
];

const OT_NAICS = [
  "541512", "541513", "541519",
  "334111", "334118", "334290",
  "335999", "333914", "333996",
  "237130", "237110",
  "541330",
];

const AGENCY_SECTOR_MAP: Record<string, Signal["sector"]> = {
  "department of defense": "defense",
  "department of the army": "defense",
  "department of the navy": "defense",
  "department of the air force": "defense",
  "defense logistics agency": "defense",
  "defense advanced research projects agency": "defense",
  "missile defense agency": "defense",
  "department of energy": "energy",
  "nuclear regulatory commission": "nuclear",
  "environmental protection agency": "chemical",
  "department of homeland security": "defense",
  "national aeronautics and space administration": "aerospace",
  "federal aviation administration": "aerospace",
  "food and drug administration": "pharma",
  "department of health and human services": "pharma",
  "pipeline and hazardous materials safety administration": "oil-gas",
  "federal energy regulatory commission": "energy",
  "national nuclear security administration": "nuclear",
};

const SECTOR_KEYWORDS: [RegExp, Signal["sector"]][] = [
  [/\b(missile|military|dod|darpa|army|navy|air\s*force|marine corps|combat|munition|weapon)\b/i, "defense"],
  [/\b(aerospace|nasa|aviation|faa|spacecraft|satellite|rocket)\b/i, "aerospace"],
  [/\b(nuclear|nrc|reactor|uranium|enrichment|fission|isotope)\b/i, "nuclear"],
  [/\b(semiconductor|chip\s*fab|wafer|tsmc|intel\s+corp|micron|foundry|lithography)\b/i, "semiconductor"],
  [/\b(data\s*center|hyperscale|cloud\s+infrastructure|server\s*farm|colocation)\b/i, "data-center"],
  [/\b(energy|electric|utility|grid|power\s*plant|solar|wind|ferc|doe\b|turbine|substation|generator)\b/i, "energy"],
  [/\b(pipeline|oil|petroleum|refinery|lng|natural\s*gas|drilling|crude)\b/i, "oil-gas"],
  [/\b(pharmac|drug\b|fda|biotech|clinical\s*trial|gxp|biologic)\b/i, "pharma"],
  [/\b(life.?science|medical\s*device|diagnostic)\b/i, "life-sciences"],
  [/\b(chemical|hazardous|toxic|pfas|epa\s+reg|pesticide)\b/i, "chemical"],
  [/\b(water|wastewater|treatment\s*plant|reservoir|desalination|potable)\b/i, "water"],
  [/\b(battery|lithium|cathode|anode|ev\s+battery|gigafactory|cell\s+manufacturing)\b/i, "ev-battery"],
  [/\b(mining|mineral|rare\s*earth|critical\s*mineral|cobalt|nickel\s+ore)\b/i, "critical-minerals"],
];

function inferSector(agency: string, description: string, naics: string | null): Signal["sector"] {
  const agencyLower = agency.toLowerCase();
  for (const [key, sector] of Object.entries(AGENCY_SECTOR_MAP)) {
    if (agencyLower.includes(key)) return sector;
  }

  const text = `${agency} ${description}`;
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
    if (p4 === "2131" || p4 === "2122") return "critical-minerals";
    if (p3 === "324") return "oil-gas";
    if (p3 === "541") return "defense";
  }

  return "manufacturing";
}

interface USASpendingAward {
  "Award ID": string;
  "Recipient Name": string;
  "Award Amount": number;
  "Total Outlays": number;
  Description: string;
  "Award Type": string;
  "Awarding Agency": string;
  "Awarding Sub Agency": string;
  "Start Date": string;
  "End Date": string;
  "Place of Performance State Code": string;
  "Place of Performance City Name"?: string;
  NAICS: string;
  "PSC Code"?: string;
  generated_internal_id: string;
}

export async function fetchUSASpendingSignals(): Promise<Signal[]> {
  const signals: Signal[] = [];

  try {
    const body = {
      filters: {
        time_period: [
          {
            start_date: getDateDaysAgo(180),
            end_date: new Date().toISOString().split("T")[0],
          },
        ],
        naics_codes: OT_NAICS,
        award_type_codes: ["A", "B", "C", "D", "IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Total Outlays",
        "Description",
        "Award Type",
        "Awarding Agency",
        "Awarding Sub Agency",
        "Start Date",
        "End Date",
        "Place of Performance State Code",
        "Place of Performance City Name",
        "NAICS",
        "PSC Code",
        "generated_internal_id",
      ],
      limit: 100,
      page: 1,
      sort: "Award Amount",
      order: "desc",
    };

    const res = await fetch(
      "https://api.usaspending.gov/api/v2/search/spending_by_award/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) return signals;

    const data = await res.json();
    const results = (data.results || []) as USASpendingAward[];

    for (const award of results) {
      const id = `usaspending-${award.generated_internal_id || award["Award ID"]}`;
      if (signals.some((s) => s.id === id)) continue;

      const description = award.Description || `${award["Award Type"]} to ${award["Recipient Name"]}`;
      const fullText = extractTextForScoring(
        award as unknown as Record<string, unknown>,
        description,
        [award["Recipient Name"], award["Awarding Agency"], award.NAICS]
      );
      const { score, keywords } = computeOtRelevanceScore(fullText);

      const state = award["Place of Performance State Code"] || "";
      const city = award["Place of Performance City Name"] || "";
      const location = city && state ? `${city}, ${state}` : state || "United States";

      signals.push({
        id,
        source: "usaspending",
        sourceId: award["Award ID"] || award.generated_internal_id,
        timestamp: new Date(award["Start Date"]).toISOString(),
        entity: award["Recipient Name"] || "Unknown",
        sector: inferSector(award["Awarding Agency"] || "", description, award.NAICS),
        signalType: "contract-award",
        location,
        value: Math.round(award["Award Amount"] || 0),
        description: description.slice(0, 2000),
        url: `https://www.usaspending.gov/award/${award.generated_internal_id}`,
        otRelevanceScore: score,
        otKeywords: keywords,
        rawData: {
          award_id: award["Award ID"],
          award_type: award["Award Type"],
          agency: award["Awarding Agency"],
          sub_agency: award["Awarding Sub Agency"],
          naics: award.NAICS,
          psc: award["PSC Code"],
        },
      });
    }

    // Second pass: keyword search for OT-specific terms
    for (const keyword of OT_KEYWORDS_FILTER.slice(0, 5)) {
      try {
        const kwBody = {
          filters: {
            time_period: [
              {
                start_date: getDateDaysAgo(90),
                end_date: new Date().toISOString().split("T")[0],
              },
            ],
            keyword: keyword,
            award_type_codes: ["A", "B", "C", "D"],
          },
          fields: [
            "Award ID",
            "Recipient Name",
            "Award Amount",
            "Description",
            "Award Type",
            "Awarding Agency",
            "Start Date",
            "Place of Performance State Code",
            "Place of Performance City Name",
            "NAICS",
            "generated_internal_id",
          ],
          limit: 25,
          page: 1,
          sort: "Award Amount",
          order: "desc",
        };

        const kwRes = await fetch(
          "https://api.usaspending.gov/api/v2/search/spending_by_award/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(kwBody),
          }
        );

        if (!kwRes.ok) continue;
        const kwData = await kwRes.json();
        const kwResults = (kwData.results || []) as USASpendingAward[];

        for (const award of kwResults) {
          const id = `usaspending-${award.generated_internal_id || award["Award ID"]}`;
          if (signals.some((s) => s.id === id)) continue;

          const description = award.Description || `${award["Award Type"]} to ${award["Recipient Name"]}`;
          const fullText = extractTextForScoring(
            award as unknown as Record<string, unknown>,
            description,
            [award["Recipient Name"], award["Awarding Agency"]]
          );
          const { score, keywords: kws } = computeOtRelevanceScore(fullText);

          const state = award["Place of Performance State Code"] || "";
          const city = award["Place of Performance City Name"] || "";
          const location = city && state ? `${city}, ${state}` : state || "United States";

          signals.push({
            id,
            source: "usaspending",
            sourceId: award["Award ID"] || award.generated_internal_id,
            timestamp: new Date(award["Start Date"]).toISOString(),
            entity: award["Recipient Name"] || "Unknown",
            sector: inferSector(award["Awarding Agency"] || "", description, award.NAICS),
            signalType: "contract-award",
            location,
            value: Math.round(award["Award Amount"] || 0),
            description: description.slice(0, 2000),
            url: `https://www.usaspending.gov/award/${award.generated_internal_id}`,
            otRelevanceScore: score,
            otKeywords: kws,
            rawData: {
              award_id: award["Award ID"],
              award_type: award["Award Type"],
              agency: award["Awarding Agency"],
              naics: award.NAICS,
              keyword_match: keyword,
            },
          });
        }

        await sleep(300);
      } catch {
        // continue
      }
    }
  } catch {
    // return whatever we have
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
