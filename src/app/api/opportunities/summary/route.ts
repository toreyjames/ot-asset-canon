import { NextResponse } from "next/server";
import { summarizeOpportunityFlow } from "@/lib/industrial-tracker/opportunity-query";
import { IndustrialOpportunitySummaryRequestSchema } from "@/lib/industrial-opportunity-tracker/summary-schema";

function parseSummaryRequest(searchParams: URLSearchParams) {
  return IndustrialOpportunitySummaryRequestSchema.safeParse({
    rollup: searchParams.get("rollup") ?? "county",
    minimumAmount: searchParams.has("minimumAmount")
      ? Number(searchParams.get("minimumAmount"))
      : undefined,
    includePermits: searchParams.has("includePermits")
      ? searchParams.get("includePermits") !== "false"
      : true,
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = parseSummaryRequest(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid opportunity summary query. Prefer /api/industrial-opportunity-tracker/summary for the namespaced Opportunity Tracker API inside Industrial Tracker.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const summary = await summarizeOpportunityFlow(parsed.data);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Opportunity summary error", error);
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
          error:
            "Invalid opportunity summary request. Prefer /api/industrial-opportunity-tracker/summary for the namespaced Opportunity Tracker API inside Industrial Tracker.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const summary = await summarizeOpportunityFlow(parsed.data);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Opportunity summary error", error);
    return NextResponse.json(
      { error: "Failed to summarize industrial opportunity flow" },
      { status: 500 }
    );
  }
}
