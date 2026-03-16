import { CanonicalAsset, IndustrialGraph, IndustrialNode, IndustrialEdge } from "./types";

export function buildIndustrialGraph(
  facilityName: string,
  assets: CanonicalAsset[]
): IndustrialGraph {
  const facilityNode: IndustrialNode = {
    id: crypto.randomUUID(),
    type: "Facility",
    label: facilityName,
    properties: {},
  };

  const zoneMap = new Map<string, IndustrialNode>();
  const nodes: IndustrialNode[] = [facilityNode];
  const edges: IndustrialEdge[] = [];

  for (const asset of assets) {
    let zoneNode: IndustrialNode | undefined;

    if (asset.zone) {
      zoneNode = zoneMap.get(asset.zone);
      if (!zoneNode) {
        zoneNode = {
          id: crypto.randomUUID(),
          type: "Zone",
          label: asset.zone,
          properties: {},
        };
        zoneMap.set(asset.zone, zoneNode);
        nodes.push(zoneNode);
        edges.push({
          id: crypto.randomUUID(),
          type: "part_of",
          from: zoneNode.id,
          to: facilityNode.id,
          confidence: 0.95,
        });
      }
    }

    const assetNode: IndustrialNode = {
      id: asset.id,
      type: "Asset",
      label: asset.canonicalName,
      properties: {
        vendor: asset.vendor,
        ...asset.properties,
      },
    };

    nodes.push(assetNode);
    edges.push({
      id: crypto.randomUUID(),
      type: zoneNode ? "located_in" : "part_of",
      from: assetNode.id,
      to: zoneNode ? zoneNode.id : facilityNode.id,
      confidence: asset.confidence,
    });
  }

  return { nodes, edges };
}
