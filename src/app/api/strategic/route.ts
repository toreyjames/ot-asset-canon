import { NextResponse } from "next/server";
import { getStrategicView } from "@/lib/canonical/service";

export async function GET() {
  try {
    const strategic = await getStrategicView();
    return NextResponse.json(strategic);
  } catch (error) {
    console.error("/api/strategic error", error);
    return NextResponse.json({ error: "Failed to load strategic view" }, { status: 500 });
  }
}
