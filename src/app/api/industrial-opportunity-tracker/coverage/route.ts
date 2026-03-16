import { NextResponse } from "next/server";
import { loadIndustrialTrackerCoverageDashboard } from "@/lib/industrial-tracker/coverage-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await loadIndustrialTrackerCoverageDashboard();
  return NextResponse.json(dashboard);
}
