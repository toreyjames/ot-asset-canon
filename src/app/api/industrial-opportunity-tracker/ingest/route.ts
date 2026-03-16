import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INDUSTRIAL_TRACKER_INGEST_KEY;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token && token === secret) return true;

  return false;
}

function parseSources(raw: string | null) {
  if (!raw) return undefined;
  const sources = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return sources.length ? sources : undefined;
}

async function runIngest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  // Dynamic import keeps the API route thin and reuses the CLI runner.
  const { runIndustrialTrackerIngestion } = await import("../../../../../scripts/ingest-industrial-tracker.mjs");

  const url = new URL(request.url);
  const querySources = parseSources(url.searchParams.get("sources"));
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const bodySources = parseSources(typeof body?.sources === "string" ? body.sources : Array.isArray(body?.sources) ? body.sources.join(",") : null);
  const sources = bodySources || querySources;

  const result = await runIndustrialTrackerIngestion({ sources });
  return NextResponse.json({
    ok: result.failures.length === 0,
    ...result,
    triggeredAt: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  return runIngest(request);
}

export async function POST(request: NextRequest) {
  return runIngest(request);
}
