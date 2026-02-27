import { NextResponse } from "next/server";
import { reconstructPlant, generateVisualizationData } from "@/lib/plant-reconstruction";
import { analyzeProcessEngineering } from "@/lib/process-engineering-analysis";
import { CHEMICAL_PLANT_ASSETS } from "@/data/chemical-plant-assets";

export const dynamic = "force-dynamic";

/**
 * GET /api/reconstruct
 *
 * Analyze the asset inventory and reconstruct the plant
 */
export async function GET() {
  try {
    const reconstruction = reconstructPlant(CHEMICAL_PLANT_ASSETS);
    const visualization = generateVisualizationData(reconstruction);
    const engineeringAnalysis = analyzeProcessEngineering(CHEMICAL_PLANT_ASSETS);

    return NextResponse.json({
      reconstruction,
      visualization,
      engineeringAnalysis,
      assetCount: CHEMICAL_PLANT_ASSETS.length
    });
  } catch (error) {
    console.error("Plant reconstruction error:", error);
    return NextResponse.json(
      { error: "Failed to reconstruct plant" },
      { status: 500 }
    );
  }
}
