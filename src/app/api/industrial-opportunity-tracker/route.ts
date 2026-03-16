import { NextResponse } from "next/server";
import { getIndustrialOpportunityTrackerOverview } from "@/lib/industrial-opportunity-tracker/source-catalog";

export async function GET() {
  return NextResponse.json(getIndustrialOpportunityTrackerOverview());
}
