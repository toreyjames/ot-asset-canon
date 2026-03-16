import { NextResponse } from "next/server";
import { getFacilityProfile } from "@/lib/canonical/service";

export async function GET(_req: Request, { params }: { params: Promise<{ facilityId: string }> }) {
  try {
    const { facilityId: rawFacilityId } = await params;
    const facilityId = decodeURIComponent(rawFacilityId);
    const facility = await getFacilityProfile(facilityId);
    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }
    return NextResponse.json(facility);
  } catch (error) {
    console.error("/api/facility/[facilityId] error", error);
    return NextResponse.json({ error: "Failed to load facility profile" }, { status: 500 });
  }
}
