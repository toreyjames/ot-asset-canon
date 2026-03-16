import { NextResponse } from "next/server";
import {
  INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
  INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
} from "@/lib/industrial-opportunity-tracker/source-catalog";
import { industrialTrackerDemoSnapshot } from "@/lib/industrial-tracker/demo-data";

export async function GET() {
  return NextResponse.json({
    trackerId: INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
    trackerName: INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
    mode: "demo",
    snapshot: industrialTrackerDemoSnapshot,
  });
}
