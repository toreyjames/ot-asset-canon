import { NextResponse } from "next/server";
import { checkInventoryCompleteness, analyzeGaps } from "@/lib/inventory-completeness";
import {
  buildCoverageBaseline,
  generateSyntheticSiteData,
  sampledVisualizationAssets,
  type SiteProfile,
} from "@/lib/synthetic-site-generator";

export const dynamic = "force-dynamic";

interface StartAnalysisBody {
  siteName?: string;
  siteSlug?: string;
  profile?: SiteProfile;
  targetAssetCount?: number;
  visualizationAssetLimit?: number;
  seed?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StartAnalysisBody;

    const siteName = body.siteName?.trim() || "Houston Plant";
    const siteSlug = body.siteSlug?.trim() || "houston-plant";
    const profile = body.profile || "petrochemical";
    const targetAssetCount = Math.min(8000, Math.max(200, body.targetAssetCount ?? 2400));
    const visualizationAssetLimit = Math.min(700, Math.max(150, body.visualizationAssetLimit ?? 420));

    const generated = generateSyntheticSiteData({
      siteName,
      siteSlug,
      profile,
      targetAssetCount,
      seed: body.seed,
    });

    const completeness = checkInventoryCompleteness(generated.assets);
    const gaps = analyzeGaps(generated.assets, completeness.inferredPlantType);
    const coverageBaseline = buildCoverageBaseline(generated.assets);
    const visualizationAssets = sampledVisualizationAssets(generated.assets, visualizationAssetLimit);

    return NextResponse.json({
      site: generated.metadata,
      coverageBaseline,
      dataset: {
        totalAssets: generated.assets.length,
        visualizationAssets: visualizationAssets.length,
      },
      completeness,
      gaps,
      assets: visualizationAssets,
    });
  } catch (error) {
    console.error("Start analysis error:", error);
    return NextResponse.json({ error: "Failed to start analysis" }, { status: 500 });
  }
}
