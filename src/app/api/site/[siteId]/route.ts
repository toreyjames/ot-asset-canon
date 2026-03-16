import { NextResponse } from "next/server";
import { getSiteProfile } from "@/lib/canonical/service";

export async function GET(_req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId: rawSiteId } = await params;
    const siteId = decodeURIComponent(rawSiteId);
    const site = await getSiteProfile(siteId);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
    return NextResponse.json(site);
  } catch (error) {
    console.error("/api/site/[siteId] error", error);
    return NextResponse.json({ error: "Failed to load site profile" }, { status: 500 });
  }
}
