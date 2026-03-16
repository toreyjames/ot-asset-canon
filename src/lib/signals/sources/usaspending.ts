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

function naicsToSector(naics: string | null): Signal["sector"] {
  if (!naics) return "manufacturing";
  const prefix = naics.slice(0, 3);
  if (prefix === "336") return "defense";
  if (prefix === "334") return "semiconductor";
  if (prefix === "325") return "chemical";
  if (prefix === "221") return "energy";
  if (prefix === "237") return "energy";
  if (prefix === "541") return "defense";
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
        sector: naicsToSector(award.NAICS),
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
            sector: naicsToSector(award.NAICS),
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
