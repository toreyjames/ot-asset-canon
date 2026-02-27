import { NextResponse } from "next/server";
import { db } from "@/db";
import { assets, ingestionJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

export const maxDuration = 300; // 5 minutes for large file processing

// Supported ingestion sources
type IngestionSource =
  | "claroty"
  | "dragos"
  | "nozomi"
  | "nessus"
  | "qualys"
  | "tenable"
  | "manual"
  | "pid_export";

interface IngestionResult {
  jobId: string;
  status: "completed" | "failed" | "partial";
  assetsCreated: number;
  assetsUpdated: number;
  errors: string[];
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const source = formData.get("source") as IngestionSource;

    if (!file || !source) {
      return NextResponse.json(
        { error: "File and source are required" },
        { status: 400 }
      );
    }

    // Store file in Vercel Blob
    const blob = await put(`ingestion/${source}/${file.name}`, file, {
      access: "public",
    });

    // Create ingestion job
    const content = await file.text();
    return processIngestion(source, content, blob.url, file.name);
  } else {
    // Direct JSON payload
    const { source, data } = await request.json();

    if (!source || !data) {
      return NextResponse.json(
        { error: "Source and data are required" },
        { status: 400 }
      );
    }

    return processIngestion(source, JSON.stringify(data), undefined, "direct-api");
  }
}

async function processIngestion(
  source: IngestionSource,
  content: string,
  blobUrl?: string,
  fileName?: string
): Promise<NextResponse> {
  const result: IngestionResult = {
    jobId: crypto.randomUUID(),
    status: "completed",
    assetsCreated: 0,
    assetsUpdated: 0,
    errors: [],
  };

  try {
    // Create job record
    await db.insert(ingestionJobs).values({
      id: result.jobId,
      sourceType: source,
      fileName,
      blobUrl,
      status: "processing",
      startedAt: new Date(),
    });

    // Parse based on source type
    let parsedAssets: ParsedAsset[] = [];

    switch (source) {
      case "claroty":
        parsedAssets = parseClarotyExport(content);
        break;
      case "dragos":
        parsedAssets = parseDragosExport(content);
        break;
      case "nozomi":
        parsedAssets = parseNozomiExport(content);
        break;
      case "nessus":
      case "qualys":
      case "tenable":
        parsedAssets = parseVulnerabilityScan(content, source);
        break;
      case "manual":
      case "pid_export":
        parsedAssets = parseManualEntry(content);
        break;
      default:
        throw new Error(`Unknown source: ${source}`);
    }

    // Upsert assets into Canon
    for (const asset of parsedAssets) {
      try {
        const existing = await db.query.assets.findFirst({
          where: (a, { eq }) => eq(a.tagNumber, asset.tagNumber),
        });

        if (existing) {
          // Update existing asset
          await db
            .update(assets)
            .set({
              ...asset.data,
              updatedAt: new Date(),
              sourceSystem: source,
            })
            .where(eq(assets.id, existing.id));
          result.assetsUpdated++;
        } else {
          // Create new asset
          await db.insert(assets).values({
            tagNumber: asset.tagNumber,
            name: asset.name,
            assetType: (asset.data.assetType as string) || "plc",
            layer: (asset.data.layer as number) || 3,
            riskTier: (asset.data.riskTier as string) || "medium",
            ...asset.data,
            sourceSystem: source,
          });
          result.assetsCreated++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to process asset ${asset.tagNumber}: ${error}`
        );
      }
    }

    // Update job status
    await db
      .update(ingestionJobs)
      .set({
        status: result.errors.length > 0 ? "partial" : "completed",
        assetsCreated: result.assetsCreated,
        assetsUpdated: result.assetsUpdated,
        errors: result.errors,
        completedAt: new Date(),
      })
      .where(eq(ingestionJobs.id, result.jobId));

    return NextResponse.json(result);
  } catch (error) {
    result.status = "failed";
    result.errors.push(`Ingestion failed: ${error}`);

    // Update job as failed
    try {
      await db
        .update(ingestionJobs)
        .set({
          status: "failed",
          errors: result.errors,
          completedAt: new Date(),
        })
        .where(eq(ingestionJobs.id, result.jobId));
    } catch (e) {
      // DB not configured
    }

    return NextResponse.json(result, { status: 500 });
  }
}

// Type for parsed assets
interface ParsedAsset {
  tagNumber: string;
  name: string;
  data: Record<string, unknown>;
}

// Parser for Claroty export format
function parseClarotyExport(content: string): ParsedAsset[] {
  const assets: ParsedAsset[] = [];

  try {
    // Claroty typically exports CSV or JSON
    const data = content.startsWith("[") ? JSON.parse(content) : parseCSV(content);

    for (const row of data) {
      assets.push({
        tagNumber: row.asset_id || row.device_name || `CLR-${row.ip_address}`,
        name: row.device_name || row.asset_name || "Unknown Device",
        data: {
          assetType: mapClarotyType(row.device_type || row.category),
          layer: inferLayer(row.device_type || row.category),
          ipAddress: row.ip_address,
          macAddress: row.mac_address,
          controlSystem: {
            controllerMake: row.vendor,
            controllerModel: row.model,
            firmwareVersion: row.firmware_version,
          },
          networkZone: row.network_segment || row.zone,
          protocols: row.protocols?.split(",") || [],
          riskTier: mapRiskLevel(row.risk_level),
        },
      });
    }
  } catch (error) {
    console.error("Error parsing Claroty export:", error);
  }

  return assets;
}

// Parser for Dragos export format
function parseDragosExport(content: string): ParsedAsset[] {
  const assets: ParsedAsset[] = [];

  try {
    const data = content.startsWith("[") ? JSON.parse(content) : parseCSV(content);

    for (const row of data) {
      assets.push({
        tagNumber: row.asset_name || row.hostname || `DRG-${row.ip}`,
        name: row.asset_name || row.hostname || "Unknown",
        data: {
          assetType: mapDragosType(row.asset_type),
          layer: inferLayer(row.asset_type),
          ipAddress: row.ip,
          macAddress: row.mac,
          controlSystem: {
            controllerMake: row.manufacturer,
            controllerModel: row.product,
            firmwareVersion: row.version,
          },
          networkZone: row.zone,
          protocols: row.protocols || [],
          cveCount: row.vulnerability_count || 0,
          riskTier: mapRiskLevel(row.risk),
        },
      });
    }
  } catch (error) {
    console.error("Error parsing Dragos export:", error);
  }

  return assets;
}

// Parser for Nozomi export format
function parseNozomiExport(content: string): ParsedAsset[] {
  const assets: ParsedAsset[] = [];

  try {
    const data = content.startsWith("[") ? JSON.parse(content) : parseCSV(content);

    for (const row of data) {
      assets.push({
        tagNumber: row.label || row.name || `NOZ-${row.ip}`,
        name: row.label || row.name || "Unknown",
        data: {
          assetType: mapNozomiType(row.type),
          layer: inferLayer(row.type),
          ipAddress: row.ip,
          macAddress: row.mac_address,
          controlSystem: {
            controllerMake: row.vendor,
            controllerModel: row.product_name,
            firmwareVersion: row.firmware,
          },
          networkZone: row.zone_name,
          protocols: row.protocols?.split(";") || [],
          riskTier: "medium",
        },
      });
    }
  } catch (error) {
    console.error("Error parsing Nozomi export:", error);
  }

  return assets;
}

// Parser for vulnerability scanner exports
function parseVulnerabilityScan(
  content: string,
  source: "nessus" | "qualys" | "tenable"
): ParsedAsset[] {
  const assets: ParsedAsset[] = [];
  const assetMap = new Map<string, ParsedAsset>();

  try {
    const data = content.startsWith("[") ? JSON.parse(content) : parseCSV(content);

    for (const row of data) {
      const ip = row.ip_address || row.host || row.ip;
      const existing = assetMap.get(ip);

      if (existing) {
        // Aggregate CVE counts
        const currentCritical = (existing.data.criticalCveCount as number) || 0;
        const currentHigh = (existing.data.highCveCount as number) || 0;
        const currentTotal = (existing.data.cveCount as number) || 0;

        const severity = row.severity || row.risk || "";
        if (severity.toLowerCase().includes("critical")) {
          existing.data.criticalCveCount = currentCritical + 1;
        } else if (severity.toLowerCase().includes("high")) {
          existing.data.highCveCount = currentHigh + 1;
        }
        existing.data.cveCount = currentTotal + 1;
      } else {
        const newAsset: ParsedAsset = {
          tagNumber: row.hostname || row.netbios_name || `VULN-${ip}`,
          name: row.hostname || row.netbios_name || ip,
          data: {
            assetType: inferAssetTypeFromOS(row.os || row.operating_system),
            layer: 4, // Default to operations layer for scanned devices
            ipAddress: ip,
            cveCount: 1,
            criticalCveCount: row.severity?.toLowerCase().includes("critical") ? 1 : 0,
            highCveCount: row.severity?.toLowerCase().includes("high") ? 1 : 0,
            riskTier: mapRiskLevel(row.severity),
            lastSecurityAssessment: new Date(),
          },
        };
        assetMap.set(ip, newAsset);
      }
    }

    assets.push(...assetMap.values());
  } catch (error) {
    console.error(`Error parsing ${source} export:`, error);
  }

  return assets;
}

// Parser for manual/P&ID entries
function parseManualEntry(content: string): ParsedAsset[] {
  const assets: ParsedAsset[] = [];

  try {
    const data = JSON.parse(content);
    const entries = Array.isArray(data) ? data : [data];

    for (const entry of entries) {
      assets.push({
        tagNumber: entry.tagNumber || entry.tag,
        name: entry.name || entry.description,
        data: {
          assetType: entry.assetType || entry.type,
          layer: entry.layer || inferLayer(entry.assetType || entry.type),
          description: entry.description,
          engineering: entry.engineering,
          controlSystem: entry.controlSystem,
          ipAddress: entry.ipAddress,
          networkZone: entry.networkZone,
          riskTier: entry.riskTier || "medium",
        },
      });
    }
  } catch (error) {
    console.error("Error parsing manual entry:", error);
  }

  return assets;
}

// Helper: Parse CSV to array of objects
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j]?.trim() || "";
    });
    rows.push(row);
  }

  return rows;
}

// Helper: Map vendor-specific device types to Canon asset types
function mapClarotyType(type: string): string {
  const typeMap: Record<string, string> = {
    plc: "plc",
    "plc/rtu": "plc",
    hmi: "hmi",
    "engineering workstation": "engineering_workstation",
    historian: "historian",
    switch: "switch",
    router: "router",
    firewall: "firewall",
  };
  return typeMap[type?.toLowerCase()] || "plc";
}

function mapDragosType(type: string): string {
  const typeMap: Record<string, string> = {
    controller: "plc",
    hmi: "hmi",
    workstation: "engineering_workstation",
    server: "historian",
    network: "switch",
  };
  return typeMap[type?.toLowerCase()] || "plc";
}

function mapNozomiType(type: string): string {
  const typeMap: Record<string, string> = {
    plc: "plc",
    rtu: "rtu",
    hmi: "hmi",
    scada: "scada_master",
    engineering: "engineering_workstation",
  };
  return typeMap[type?.toLowerCase()] || "plc";
}

// Helper: Infer Canon layer from asset type
function inferLayer(type: string): number {
  const layerMap: Record<string, number> = {
    reactor: 1,
    pump: 1,
    tank: 1,
    temperature_sensor: 2,
    pressure_sensor: 2,
    control_valve: 2,
    plc: 3,
    dcs_controller: 3,
    rtu: 3,
    hmi: 4,
    historian: 4,
    engineering_workstation: 4,
    scada_master: 4,
    switch: 5,
    router: 5,
    firewall: 5,
    vpn_concentrator: 6,
    erp_connector: 6,
  };
  return layerMap[type?.toLowerCase()] || 3;
}

// Helper: Map risk/severity levels
function mapRiskLevel(level: string): "critical" | "high" | "medium" | "low" {
  const l = level?.toLowerCase() || "";
  if (l.includes("critical") || l.includes("severe")) return "critical";
  if (l.includes("high")) return "high";
  if (l.includes("medium") || l.includes("moderate")) return "medium";
  return "low";
}

// Helper: Infer asset type from OS
function inferAssetTypeFromOS(os: string): string {
  const o = os?.toLowerCase() || "";
  if (o.includes("windows server")) return "historian";
  if (o.includes("windows")) return "engineering_workstation";
  if (o.includes("linux")) return "opc_server";
  return "engineering_workstation";
}
