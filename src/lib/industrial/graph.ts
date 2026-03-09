import { CanonicalAsset, IndustrialEdge, IndustrialGraph, IndustrialNode } from "./types";

export function buildIndustrialGraph(
  facilityName: string,
  assets: CanonicalAsset[]
): IndustrialGraph {
  const facilityId = `facility_${facilityName.toLowerCase().replace(/\s+/g, "_")}`;

  const nodes: IndustrialNode[] = [
    {
      id: facilityId,
      type: "Facility",
      label: facilityName,
      properties: {},
    },
  ];

  const edges: IndustrialEdge[] = [];
  const zones = new Map<string, string>();

  for (const asset of assets) {
    nodes.push({
      id: asset.id,
      type: "Asset",
      label: asset.canonicalName,
      properties: {
        vendor: asset.vendor,
        confidence: asset.confidence,
        aliases: asset.aliases,
      },
    });

    edges.push({
      id: `${facilityId}_${asset.id}_part_of`,
      type: "part_of",
      from: asset.id,
      to: facilityId,
      confidence: asset.confidence,
    });

    if (asset.zone) {
      const zoneKey = asset.zone.toLowerCase().replace(/\s+/g, "_");
      const zoneId = `zone_${zoneKey}`;
      if (!zones.has(zoneId)) {
        zones.set(zoneId, asset.zone);
        nodes.push({
          id: zoneId,
          type: "Zone",
          label: asset.zone,
          properties: {},
        });
        edges.push({
          id: `${zoneId}_${facilityId}_part_of`,
          type: "part_of",
          from: zoneId,
          to: facilityId,
          confidence: 0.95,
        });
      }

      edges.push({
        id: `${asset.id}_${zoneId}_located_in`,
        type: "located_in",
        from: asset.id,
        to: zoneId,
        confidence: asset.confidence,
      });
    }
  }

  return { nodes, edges };
}
