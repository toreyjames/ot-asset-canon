import { NextResponse } from "next/server";
import { getIssueCenter } from "@/lib/canonical/service";

export async function GET() {
  try {
    const issues = await getIssueCenter();
    return NextResponse.json({ issues, count: issues.length });
  } catch (error) {
    console.error("/api/issues error", error);
    return NextResponse.json({ error: "Failed to load issues" }, { status: 500 });
  }
}
