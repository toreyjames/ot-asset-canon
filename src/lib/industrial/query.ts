import { GraphQueryRequest, GraphQueryResult, IndustrialGraph } from "./types";

export function executeGraphQuery(
  graph: IndustrialGraph,
  request: GraphQueryRequest
): GraphQueryResult {
  const q = request.query.toLowerCase();

  if (request.mode === "search" || request.mode === "natural") {
    const matchedNodes = graph.nodes.filter((n) => n.label.toLowerCase().includes(q));
    const matchedIds = new Set(matchedNodes.map((n) => n.id));
    const matchedEdges = graph.edges.filter((e) => matchedIds.has(e.from) || matchedIds.has(e.to));

    return {
      summary: matchedNodes.length
        ? `Found ${matchedNodes.length} matching infrastructure objects.`
        : "No matching infrastructure objects found.",
      nodes: matchedNodes,
      edges: matchedEdges,
    };
  }

  // Graph traversal mode (MVP: simple dependency view)
  const pivot = graph.nodes.find((n) => n.label.toLowerCase().includes(q));
  if (!pivot) {
    return {
      summary: "No pivot node found for traversal.",
      nodes: [],
      edges: [],
    };
  }

  const connected = graph.edges.filter((e) => e.from === pivot.id || e.to === pivot.id);
  const ids = new Set<string>([pivot.id]);
  connected.forEach((edge) => {
    ids.add(edge.from);
    ids.add(edge.to);
  });

  return {
    summary: `Showing ${connected.length} direct relationships for ${pivot.label}.`,
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: connected,
  };
}
