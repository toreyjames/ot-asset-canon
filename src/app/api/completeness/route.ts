import { NextResponse } from "next/server";
import { checkInventoryCompleteness } from "@/lib/inventory-completeness";
import { CHEMICAL_PLANT_ASSETS } from "@/data/chemical-plant-assets";

export const dynamic = "force-dynamic";

/**
 * GET /api/completeness
 *
 * Returns the completeness score with engineering gap integration
 */
export async function GET() {
  const completeness = checkInventoryCompleteness(CHEMICAL_PLANT_ASSETS);

  return NextResponse.json({
    overallScore: completeness.overallScore,
    canRunPlant: completeness.canRunPlant,
    engineeringGaps: completeness.engineeringGaps,
    criticalGapCount: completeness.criticalGapCount,
    warningGapCount: completeness.warningGapCount,
    recommendations: completeness.recommendations,
  });
}
