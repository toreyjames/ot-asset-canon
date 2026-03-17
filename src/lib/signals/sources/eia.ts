import type { Signal } from "../types";
import { computeOtRelevanceScore, extractTextForScoring } from "../ot-relevance";

interface EIAPlantRecord {
  plantCode: string;
  plantName: string;
  state: string;
  sector: string;
  fuel2002: string;
  primeMover: string;
  generation: number;
  period: string;
  stateDescription?: string;
}

export async function fetchEiaSignals(): Promise<Signal[]> {
  const signals: Signal[] = [];
  const apiKey = process.env.EIA_API_KEY;

  if (!apiKey) return signals;

  const stateGroups = [
    ["TX", "OH", "PA", "IL", "IN"],
    ["LA", "CA", "WA", "SC", "GA"],
  ];

  for (const states of stateGroups) {
    try {
      const facets = states.map((s) => `facets[state][]=${s}`).join("&");
      const url =
        `https://api.eia.gov/v2/electricity/facility-fuel/data/` +
        `?api_key=${apiKey}` +
        `&frequency=monthly` +
        `&data[0]=generation` +
        `&${facets}` +
        `&sort[0][column]=period&sort[0][direction]=desc` +
        `&offset=0&length=200`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;

      const data = await res.json();
      const records = (data.response?.data || []) as EIAPlantRecord[];

      const byPlant = new Map<string, EIAPlantRecord>();
      for (const rec of records) {
        const key = rec.plantCode;
        if (!byPlant.has(key) || Math.abs(rec.generation) > Math.abs(byPlant.get(key)!.generation)) {
          byPlant.set(key, rec);
        }
      }

      for (const [, plant] of byPlant) {
        const id = `eia-${plant.plantCode}-${plant.period}`;
        if (signals.some((s) => s.id === id)) continue;

        const description =
          `Energy facility: ${plant.plantName} (${plant.state})` +
          ` — ${plant.primeMover} using ${plant.fuel2002}` +
          `, generation: ${plant.generation?.toLocaleString()} MWh (${plant.period})`;

        const fullText = extractTextForScoring(
          plant as unknown as Record<string, unknown>,
          description,
          [plant.plantName, plant.fuel2002, plant.primeMover]
        );
        const { score, keywords } = computeOtRelevanceScore(fullText);

        signals.push({
          id,
          source: "eia",
          sourceId: plant.plantCode,
          timestamp: new Date(plant.period + "-01").toISOString(),
          entity: plant.plantName,
          sector: inferEiaSector(plant),
          signalType: "facility-permit",
          location: plant.stateDescription || plant.state || "United States",
          value: Math.round(Math.abs(plant.generation || 0)),
          description: description.slice(0, 2000),
          url: `https://www.eia.gov/electricity/data/browser/#/plant/${plant.plantCode}`,
          otRelevanceScore: score,
          otKeywords: keywords,
          rawData: {
            plant_code: plant.plantCode,
            fuel: plant.fuel2002,
            prime_mover: plant.primeMover,
            sector: plant.sector,
            period: plant.period,
            generation_mwh: plant.generation,
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

function inferEiaSector(plant: EIAPlantRecord): Signal["sector"] {
  const name = (plant.plantName || "").toLowerCase();
  const fuel = (plant.fuel2002 || "").toLowerCase();
  const sector = (plant.sector || "").toLowerCase();

  if (fuel.includes("nuc") || name.includes("nuclear")) return "nuclear";

  if (name.includes("military") || name.includes("army") || name.includes("navy") || name.includes("air force") || name.includes("dod")) return "defense";

  if (fuel.includes("pet") || fuel.includes("oil") || name.includes("refinery") || name.includes("petroleum")) return "oil-gas";

  if (sector.includes("industrial") && (name.includes("chemical") || name.includes("dow") || name.includes("basf"))) return "chemical";

  return "energy";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
