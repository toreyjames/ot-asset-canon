import { NextResponse } from "next/server";
import { z } from "zod";
import { runEdgeCollector } from "@/lib/industrial/edge-collector";
import {
  finalizeIngestionMetadata,
  normalizeIngestionRecords,
} from "@/lib/industrial/ingestion-pipeline";
import { resolveCanonicalAssets } from "@/lib/industrial/entity-resolution";
import { buildIndustrialGraph } from "@/lib/industrial/graph";
import { graphRepository } from "@/lib/industrial/graph-repository";

const CollectorRunSchema = z.object({
  mode: z.enum(["file_upload", "watched_folder", "api_pull", "scheduled_import"]),
  source: z.string().min(1),
  facilityName: z.string().min(1).default("Demo Facility"),
  scopeId: z.string().min(1).default("default"),
  records: z.array(z.record(z.unknown())).min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CollectorRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid collector payload" }, { status: 400 });
    }

    const { mode, source, facilityName, scopeId, records } = parsed.data;

    const collected = runEdgeCollector({
      mode,
      source,
      records,
    });

    if (collected.metadata.status === "failed") {
      return NextResponse.json({ metadata: collected.metadata }, { status: 400 });
    }

    const candidates = normalizeIngestionRecords(source, collected.raw);
    const canonical = resolveCanonicalAssets(candidates);
    const graph = buildIndustrialGraph(facilityName, canonical);

    await graphRepository.saveGraph(scopeId, graph);

    const metadata = finalizeIngestionMetadata(collected.metadata, candidates);

    return NextResponse.json({
      metadata,
      summary: {
        candidates: candidates.length,
        canonicalAssets: canonical.length,
        graphNodes: graph.nodes.length,
        graphEdges: graph.edges.length,
      },
    });
  } catch (error) {
    console.error("Collector run error", error);
    return NextResponse.json({ error: "Collector run failed" }, { status: 500 });
  }
}
