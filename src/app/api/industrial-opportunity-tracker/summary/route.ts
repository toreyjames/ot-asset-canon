import { NextResponse } from "next/server";
import { summarizeOpportunityFlow } from "@/lib/industrial-tracker/opportunity-query";
import {
  INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
  INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
} from "@/lib/industrial-opportunity-tracker/source-catalog";
import { IndustrialOpportunitySummaryRequestSchema } from "@/lib/industrial-opportunity-tracker/summary-schema";

function parseSummaryRequest(searchParams: URLSearchParams) {
  const parsed = IndustrialOpportunitySummaryRequestSchema.safeParse({
    rollup: searchParams.get("rollup") ?? "county",
    minimumAmount: searchParams.has("minimumAmount")
      ? Number(searchParams.get("minimumAmount"))
      : undefined,
    includePermits: searchParams.has("includePermits")
      ? searchParams.get("includePermits") !== "false"
      : true,
  });

  return parsed;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = parseSummaryRequest(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Opportunity Tracker summary query",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const summary = await summarizeOpportunityFlow(parsed.data);

    return NextResponse.json({
      trackerId: INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
      trackerName: INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
      ...summary,
    });
  } catch (error) {
    console.error("Opportunity Tracker summary error", error);
    return NextResponse.json(
      { error: "Failed to summarize industrial opportunity flow" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = IndustrialOpportunitySummaryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Opportunity Tracker summary request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const summary = await summarizeOpportunityFlow(parsed.data);

    return NextResponse.json({
      trackerId: INDUSTRIAL_OPPORTUNITY_TRACKER_ID,
      trackerName: INDUSTRIAL_OPPORTUNITY_TRACKER_NAME,
      ...summary,
    });
  } catch (error) {
    console.error("Opportunity Tracker summary error", error);
    return NextResponse.json(
      { error: "Failed to summarize industrial opportunity flow" },
      { status: 500 }
    );
  }
}
