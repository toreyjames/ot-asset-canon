import { NextRequest, NextResponse } from "next/server";
import { querySignals } from "@/lib/signals/supabase-store";
import type { SignalsResponse } from "@/lib/signals/types";

export const dynamic = "force-dynamic";

function parseCommaSeparated(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return items.length ? items : undefined;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sector = parseCommaSeparated(url.searchParams.get("sector"));
  const since = url.searchParams.get("since") || undefined;
  const signalType = parseCommaSeparated(url.searchParams.get("signalType"));
  const minRelevanceRaw = url.searchParams.get("minRelevance");
  const minRelevance = minRelevanceRaw ? parseInt(minRelevanceRaw, 10) : undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

  try {
    const { signals, total } = await querySignals({
      sector,
      since,
      signalType,
      minRelevance,
      limit,
    });

    const response: SignalsResponse = {
      success: true,
      signals,
      meta: {
        total,
        filtered: signals.length,
        timestamp: new Date().toISOString(),
        source: "ot-radar",
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        signals: [],
        meta: {
          total: 0,
          filtered: 0,
          timestamp: new Date().toISOString(),
          source: "ot-radar" as const,
        },
        error: message,
      },
      { status: 500 }
    );
  }
}
