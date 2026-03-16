import { NextResponse } from "next/server";
import { getAssetProfile } from "@/lib/canonical/service";

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId: rawAssetId } = await params;
    const assetId = decodeURIComponent(rawAssetId);
    const asset = await getAssetProfile(assetId);
    return NextResponse.json(asset);
  } catch (error) {
    console.error("/api/asset/[assetId] error", error);
    return NextResponse.json({ error: "Failed to load asset profile" }, { status: 500 });
  }
}
