import type { Signal } from "./types";
import { upsertSignals } from "./supabase-store";
import { fetchFederalRegisterSignals } from "./sources/federal-register";
import { fetchSecEdgarSignals } from "./sources/sec-edgar";
import { fetchUSASpendingSignals } from "./sources/usaspending";
import { fetchSamGovSignals } from "./sources/sam-gov";
import { fetchEpaSignals } from "./sources/epa";
import { fetchEiaSignals } from "./sources/eia";

export type SourceName =
  | "federal-register"
  | "sec-edgar"
  | "usaspending"
  | "sam.gov"
  | "epa"
  | "eia";

interface SourceResult {
  source: SourceName;
  fetched: number;
  upserted: number;
  error?: string;
  durationMs: number;
}

const SOURCE_FETCHERS: Record<SourceName, () => Promise<Signal[]>> = {
  "federal-register": fetchFederalRegisterSignals,
  "sec-edgar": fetchSecEdgarSignals,
  usaspending: fetchUSASpendingSignals,
  "sam.gov": fetchSamGovSignals,
  epa: fetchEpaSignals,
  eia: fetchEiaSignals,
};

export const ALL_SOURCES: SourceName[] = Object.keys(SOURCE_FETCHERS) as SourceName[];

export async function runIngestion(
  sources?: SourceName[]
): Promise<{ results: SourceResult[]; totalUpserted: number }> {
  const toRun = sources?.length ? sources : ALL_SOURCES;
  const results: SourceResult[] = [];
  let totalUpserted = 0;

  for (const source of toRun) {
    const fetcher = SOURCE_FETCHERS[source];
    if (!fetcher) {
      results.push({
        source,
        fetched: 0,
        upserted: 0,
        error: "Unknown source",
        durationMs: 0,
      });
      continue;
    }

    const start = Date.now();
    try {
      const signals = await fetcher();
      const validSignals = signals.filter(
        (s) => s.id && s.source && s.timestamp && s.signalType
      );
      const upserted = await upsertSignals(validSignals);
      totalUpserted += upserted;
      results.push({
        source,
        fetched: signals.length,
        upserted,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        source,
        fetched: 0,
        upserted: 0,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      });
    }
  }

  return { results, totalUpserted };
}
