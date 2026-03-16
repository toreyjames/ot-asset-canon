import { supabaseServerFetch } from "@/lib/platform/supabase-server";
import type { Signal } from "./types";

interface SignalRow {
  id: string;
  source: string;
  source_id: string;
  timestamp: string;
  entity: string;
  sector: string;
  signal_type: string;
  location: string;
  value: number;
  description: string;
  url: string;
  ot_relevance_score: number;
  ot_keywords: string[];
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function signalToRow(s: Signal): Record<string, unknown> {
  return {
    id: s.id || `unknown-${Date.now()}`,
    source: s.source || "unknown",
    source_id: s.sourceId || "",
    timestamp: s.timestamp || new Date().toISOString(),
    entity: s.entity || "Unknown",
    sector: s.sector || "manufacturing",
    signal_type: s.signalType || "contract-award",
    location: s.location || "United States",
    value: s.value ?? 0,
    description: (s.description || "").slice(0, 4000),
    url: s.url || "",
    ot_relevance_score: s.otRelevanceScore ?? 0,
    ot_keywords: s.otKeywords || [],
    raw_data: s.rawData || {},
    updated_at: new Date().toISOString(),
  };
}

function rowToSignal(r: SignalRow): Signal {
  return {
    id: r.id,
    source: r.source as Signal["source"],
    sourceId: r.source_id,
    timestamp: r.timestamp,
    entity: r.entity,
    sector: r.sector as Signal["sector"],
    signalType: r.signal_type as Signal["signalType"],
    location: r.location,
    value: Number(r.value) || 0,
    description: r.description,
    url: r.url,
    otRelevanceScore: Number(r.ot_relevance_score) || 0,
    otKeywords: r.ot_keywords || [],
    rawData: r.raw_data || {},
  };
}

export async function upsertSignals(signals: Signal[]): Promise<number> {
  if (!signals.length) return 0;

  const batchSize = 200;
  let upserted = 0;

  for (let i = 0; i < signals.length; i += batchSize) {
    const batch = signals.slice(i, i + batchSize).map(signalToRow);
    await supabaseServerFetch("signals", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    upserted += batch.length;
  }

  return upserted;
}

export async function querySignals(params: {
  sector?: string[];
  since?: string;
  signalType?: string[];
  minRelevance?: number;
  limit?: number;
}): Promise<{ signals: Signal[]; total: number }> {
  const filters: string[] = [];

  if (params.sector?.length) {
    filters.push(`sector=in.(${params.sector.join(",")})`);
  }
  if (params.since) {
    filters.push(`timestamp=gte.${params.since}`);
  }
  if (params.signalType?.length) {
    filters.push(`signal_type=in.(${params.signalType.join(",")})`);
  }
  if (params.minRelevance !== undefined && params.minRelevance > 0) {
    filters.push(`ot_relevance_score=gte.${params.minRelevance}`);
  }

  const limit = params.limit && params.limit > 0 ? params.limit : 500;

  const countPath = `signals?select=id${filters.length ? "&" + filters.join("&") : ""}`;
  const countResult = await supabaseServerFetch(countPath, {
    headers: { Prefer: "count=exact", Range: "0-0" },
  }).catch(() => []);
  const total = Array.isArray(countResult) ? countResult.length : 0;

  const queryPath = `signals?select=*&order=ot_relevance_score.desc,timestamp.desc&limit=${limit}${filters.length ? "&" + filters.join("&") : ""}`;
  const rows = (await supabaseServerFetch(queryPath)) as SignalRow[];

  return {
    signals: rows.map(rowToSignal),
    total: total || rows.length,
  };
}

export async function getSignalCount(): Promise<number> {
  const rows = (await supabaseServerFetch("signals?select=id&limit=10000")) as { id: string }[];
  return rows.length;
}
