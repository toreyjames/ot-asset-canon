import { NextRequest, NextResponse } from "next/server";
import { runIngestion, ALL_SOURCES, type SourceName } from "@/lib/signals/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret =
    process.env.CRON_SECRET ||
    process.env.INDUSTRIAL_TRACKER_INGEST_KEY;

  if (!secret) return true; // allow if no secret configured (dev mode)

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token && token === secret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sourcesParam = url.searchParams.get("sources");
  const sources = sourcesParam
    ? (sourcesParam.split(",").map((s) => s.trim()) as SourceName[])
    : undefined;

  const { results, totalUpserted } = await runIngestion(sources);

  return NextResponse.json({
    ok: results.every((r) => !r.error),
    totalUpserted,
    results,
    availableSources: ALL_SOURCES,
    triggeredAt: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
