import { NextResponse } from "next/server";
import { getMissionMapView } from "@/lib/canonical/service";

export async function GET(_req: Request, { params }: { params: Promise<{ facilityId: string }> }) {
  try {
    const { facilityId: rawFacilityId } = await params;
    const facilityId = decodeURIComponent(rawFacilityId);
    const missionMap = await getMissionMapView(facilityId);
    if (!missionMap) {
      return NextResponse.json({ error: "Mission map not found" }, { status: 404 });
    }
    return NextResponse.json(missionMap);
  } catch (error) {
    console.error("/api/mission-map/[facilityId] error", error);
    return NextResponse.json({ error: "Failed to load mission map" }, { status: 500 });
  }
}
