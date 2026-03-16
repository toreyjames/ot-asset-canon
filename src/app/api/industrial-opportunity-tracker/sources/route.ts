import { NextResponse } from "next/server";
import {
  INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
  INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
  industrialOpportunitySourceCatalog,
} from "@/lib/industrial-opportunity-tracker/source-catalog";

export async function GET() {
  return NextResponse.json({
    trackerId: INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
    trackerName: INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
    generatedAt: new Date().toISOString(),
    sources: industrialOpportunitySourceCatalog,
  });
}
