import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeGaps, checkInventoryCompleteness } from "@/lib/inventory-completeness";
import { buildCoverageBaseline, sampledVisualizationAssets } from "@/lib/synthetic-site-generator";
import type { CanonAsset, AssetType, CanonLayer } from "@/types/canon";

const BodySchema = z.object({
  siteName: z.string().min(1).default("Ingested Site"),
  siteSlug: z.string().min(1).default("ingested-site"),
  profile: z.string().optional(),
  records: z.array(z.record(z.unknown())).min(1),
});

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function inferLayer(typeRaw: string): CanonLayer {
  const type = typeRaw.toLowerCase();
  if (type.includes("switch") || type.includes("router") || type.includes("firewall")) return 5;
  if (type.includes("plc") || type.includes("controller") || type.includes("dcs") || type.includes("rtu")) return 3;
  if (type.includes("sensor") || type.includes("valve") || type.includes("analyzer")) return 2;
  if (type.includes("server") || type.includes("hmi") || type.includes("scada")) return 4;
  return 1;
}

function inferAssetType(typeRaw: string): AssetType {
  const type = typeRaw.toLowerCase();
  if (type.includes("switch")) return "switch";
  if (type.includes("router")) return "router";
  if (type.includes("firewall")) return "firewall";
  if (type.includes("plc") || type.includes("controller")) return "plc";
  if (type.includes("rtu")) return "rtu";
  if (type.includes("dcs")) return "dcs_controller";
  if (type.includes("hmi")) return "hmi";
  if (type.includes("historian")) return "historian";
  if (type.includes("sensor")) return "temperature_sensor";
  if (type.includes("valve")) return "control_valve";
  if (type.includes("pump")) return "pump";
  if (type.includes("compressor")) return "compressor";
  if (type.includes("tank")) return "tank";
  return "vessel";
}

function normalizeProfile(input?: string): string {
  if (!input) return "unknown";
  const value = input.toLowerCase();
  if (value.includes("refinery")) return "refinery";
  if (value.includes("petro")) return "petrochemical";
  if (value.includes("water")) return "water_treatment";
  if (value.includes("power")) return "power_generation";
  if (value.includes("manufact")) return "manufacturing";
  return "chemical";
}

function buildAssetsFromRecords(records: Record<string, unknown>[]): CanonAsset[] {
  const now = new Date();

  return records.map((record, index) => {
    const id = String(record.id || `ingest-${index + 1}`);
    const name = String(record.name || `Asset ${index + 1}`);
    const typeRaw = String(record.type || "asset");
    const layer = inferLayer(typeRaw);
    const assetType = inferAssetType(typeRaw);
    const seed = hashString(id);

    return {
      id,
      tagNumber: id,
      name,
      assetType,
      layer,
      engineering: {
        processArea: String(record.zone || "Unknown"),
      },
      controlSystem: {
        controllerMake: String(record.vendor || "Unknown"),
      },
      network: layer >= 3 ? {
        ipAddress: `10.${(seed % 200) + 1}.${(Math.floor(seed / 3) % 200) + 1}.${(Math.floor(seed / 7) % 200) + 1}`,
        vlan: (seed % 300) + 1,
        zone: String(record.zone || "Unknown"),
      } : undefined,
      security: {
        riskTier: layer >= 4 ? "high" : "medium",
        patchable: layer >= 3,
        cveCount: layer >= 3 ? seed % 6 : 0,
        criticalCveCount: layer >= 3 ? seed % 2 : 0,
        highCveCount: layer >= 3 ? seed % 3 : 0,
        monitoringCoverage: seed % 5 === 0 ? "partial" : "baseline",
      },
      operational: {
        criticality: layer <= 2 ? "production_critical" : "important",
      },
      createdAt: now,
      updatedAt: now,
      sourceSystem: "ingest_run",
      verified: seed % 6 !== 0,
      coordinates: {
        x: seed % 120,
        y: Math.floor(seed / 11) % 90,
        z: 0,
      },
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ingest analysis payload" }, { status: 400 });
    }

    const { siteName, siteSlug, profile, records } = parsed.data;
    const assets = buildAssetsFromRecords(records as Record<string, unknown>[]);
    const completeness = checkInventoryCompleteness(assets);
    const gaps = analyzeGaps(assets, completeness.inferredPlantType);
    const coverageBaseline = buildCoverageBaseline(assets);
    const visualizationAssets = sampledVisualizationAssets(assets, 450);
    const normalizedProfile = normalizeProfile(profile);

    return NextResponse.json({
      site: {
        siteName,
        siteSlug,
        profile: normalizedProfile,
        targetAssetCount: assets.length,
        generatedAssetCount: assets.length,
        generatedAt: new Date().toISOString(),
      },
      coverageBaseline,
      dataset: {
        totalAssets: assets.length,
        visualizationAssets: visualizationAssets.length,
      },
      completeness,
      gaps,
      assets: visualizationAssets,
    });
  } catch (error) {
    console.error("From-ingest analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze ingest payload" }, { status: 500 });
  }
}
