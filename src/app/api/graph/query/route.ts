import { NextResponse } from "next/server";
import { resolveCanonicalAssets } from "@/lib/industrial/entity-resolution";
import { buildIndustrialGraph } from "@/lib/industrial/graph";
import { executeGraphQuery } from "@/lib/industrial/query";
import { CandidateAssetRecord, GraphQueryRequest } from "@/lib/industrial/types";

const SAMPLE_CANDIDATES: CandidateAssetRecord[] = [
  {
    source: "claroty",
    sourceId: "1",
    candidateType: "asset",
    name: "Pump P-104",
    vendor: "Flowserve",
    zone: "Cooling Line B",
  },
  {
    source: "plc_export",
    sourceId: "2",
    candidateType: "asset",
    name: "PLC-12",
    vendor: "Siemens",
    zone: "Cooling Line B",
  },
  {
    source: "network",
    sourceId: "3",
    candidateType: "network",
    name: "Switch-SW-07",
    vendor: "Cisco",
    zone: "Control Room",
  },
  {
    source: "manual",
    sourceId: "4",
    candidateType: "asset",
    name: "Cooling PLC B",
    vendor: "Siemens",
    zone: "Cooling Line B",
  },
];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GraphQueryRequest;

    if (!body?.mode || !body?.query) {
      return NextResponse.json(
        { error: "mode and query are required" },
        { status: 400 }
      );
    }

    const canonical = resolveCanonicalAssets(SAMPLE_CANDIDATES);
    const graph = buildIndustrialGraph("Demo Facility", canonical);
    const result = executeGraphQuery(graph, body);

    return NextResponse.json({
      result,
      meta: {
        canonicalAssets: canonical.length,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
      },
    });
  } catch (error) {
    console.error("Graph query error", error);
    return NextResponse.json({ error: "Graph query failed" }, { status: 500 });
  }
}
