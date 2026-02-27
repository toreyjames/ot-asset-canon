import { NextRequest, NextResponse } from "next/server";
import {
  enrichAssetVulnerabilities,
  summarizeVulnerabilities,
  type AssetVulnerabilityEnrichment,
} from "@/lib/vulnerability-service";
import type { CanonAsset } from "@/types/canon";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/vulnerabilities
 *
 * Enrich assets with vulnerability data from NVD, CISA KEV, and EPSS
 *
 * Body: { assets: Partial<CanonAsset>[] }
 * Returns: { enrichments: AssetVulnerabilityEnrichment[], summary: VulnerabilitySummary }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const assets: Partial<CanonAsset>[] = body.assets || [];

    if (assets.length === 0) {
      return NextResponse.json(
        { error: "No assets provided" },
        { status: 400 }
      );
    }

    // Limit to prevent API abuse
    const maxAssets = 20;
    const assetsToEnrich = assets.slice(0, maxAssets);

    const enrichments = new Map<string, AssetVulnerabilityEnrichment>();

    // Enrich each asset (with rate limiting built into the service)
    for (const asset of assetsToEnrich) {
      if (!asset.id) continue;

      const enrichment = await enrichAssetVulnerabilities(asset);
      if (enrichment) {
        enrichments.set(asset.id, enrichment);
      }

      // Rate limit between requests (NVD API limit)
      await new Promise((resolve) => setTimeout(resolve, 6500));
    }

    const summary = summarizeVulnerabilities(enrichments);

    return NextResponse.json({
      enrichments: Array.from(enrichments.values()),
      summary,
      enrichedCount: enrichments.size,
      requestedCount: assetsToEnrich.length,
    });
  } catch (error) {
    console.error("Vulnerability enrichment error:", error);
    return NextResponse.json(
      { error: "Failed to enrich vulnerabilities" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vulnerabilities?vendor=honeywell&model=c300
 *
 * Quick lookup for a specific vendor/model
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vendor = searchParams.get("vendor");
  const model = searchParams.get("model");

  if (!vendor) {
    return NextResponse.json(
      { error: "Vendor parameter required" },
      { status: 400 }
    );
  }

  // Create a mock asset for the query
  const mockAsset: Partial<CanonAsset> = {
    id: "query",
    tagNumber: "QUERY",
    controlSystem: {
      controllerMake: vendor,
      controllerModel: model || undefined,
    },
  };

  const enrichment = await enrichAssetVulnerabilities(mockAsset);

  if (!enrichment) {
    return NextResponse.json(
      { error: "Could not find vulnerability data for this vendor/model" },
      { status: 404 }
    );
  }

  return NextResponse.json(enrichment);
}
