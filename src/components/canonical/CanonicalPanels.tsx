import type { CanonicalFact, FreshnessSummary, IssueRecord, MissionMapEdge, MissionMapNode, SourceProvenance } from "@/lib/canonical/types";

function formatDate(value?: string) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CanonicalEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded border border-zinc-700 bg-[#090909] px-4 py-4">
      <div className="spec-body">{title}</div>
      <div className="spec-cell-label mt-1">{detail}</div>
    </div>
  );
}

export function IdentityPanel({
  canonicalId,
  resolutionBasis,
  sourceIds,
}: {
  canonicalId: string;
  resolutionBasis: string;
  sourceIds?: Record<string, string>;
}) {
  return (
    <div className="rounded border border-zinc-700 bg-[#090909] px-4 py-4">
      <div className="spec-cell-label">CANONICAL ID</div>
      <div className="spec-cell-value mt-2">{canonicalId}</div>
      <div className="spec-cell-label mt-3">RESOLUTION BASIS</div>
      <div className="spec-body mt-1">{resolutionBasis}</div>
      {sourceIds && Object.keys(sourceIds).length > 0 ? (
        <>
          <div className="spec-cell-label mt-3">SOURCE IDS</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(sourceIds).map(([key, value]) => (
              <span key={key} className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                {key}: {value}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function FreshnessPanel({ freshness }: { freshness: FreshnessSummary }) {
  return (
    <div className="rounded border border-zinc-700 bg-[#090909] px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <div className="spec-cell-label">LAST OBSERVED</div>
          <div className="spec-cell-value mt-1">{formatDate(freshness.lastObservedAt)}</div>
        </div>
        <div>
          <div className="spec-cell-label">FRESHNESS</div>
          <div className="spec-cell-value mt-1">{freshness.freshness}</div>
        </div>
        <div>
          <div className="spec-cell-label">SOURCE COUNT</div>
          <div className="spec-cell-value mt-1">{freshness.sourceCount}</div>
        </div>
      </div>
      <div className="spec-cell-label mt-3">CONFIDENCE REASON</div>
      <div className="spec-body mt-1">{freshness.confidenceReason}</div>
    </div>
  );
}

export function FactsPanel({ facts }: { facts: CanonicalFact[] }) {
  return (
    <div className="divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
      {facts.length > 0 ? (
        facts.map((fact) => (
          <div key={fact.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3">
            <div>
              <div className="spec-body">{fact.label}</div>
              <div className="spec-cell-label mt-1">
                {fact.kind} • {fact.confidence} • {formatDate(fact.observedAt)}
              </div>
            </div>
            <div className="spec-cell-label">{fact.provenance.length} src</div>
          </div>
        ))
      ) : (
        <div className="px-3 py-3 spec-body">No canonical facts.</div>
      )}
    </div>
  );
}

export function ProvenancePanel({ provenance }: { provenance: SourceProvenance[] }) {
  return (
    <div className="divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
      {provenance.length > 0 ? (
        provenance.map((item, index) => (
          <div key={`${item.source}-${item.reference}-${index}`} className="px-3 py-3">
            <div className="spec-body">{item.source}</div>
            <div className="spec-cell-label mt-1">{item.reference}</div>
            <div className="spec-cell-label mt-1">{formatDate(item.observedAt)}</div>
          </div>
        ))
      ) : (
        <div className="px-3 py-3 spec-body">No provenance records.</div>
      )}
    </div>
  );
}

export function MissionMapPanel({
  nodes,
  edges,
}: {
  nodes: MissionMapNode[];
  edges: MissionMapEdge[];
}) {
  const nodesByLevel = Array.from(
    nodes.reduce<Map<number, MissionMapNode[]>>((map, node) => {
      const bucket = map.get(node.level) || [];
      bucket.push(node);
      map.set(node.level, bucket);
      return map;
    }, new Map())
  ).sort((a, b) => a[0] - b[0]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="border border-zinc-700 bg-[#090909]">
        {nodesByLevel.map(([level, levelNodes]) => (
          <div key={`level-${level}`} className="border-b border-zinc-700 last:border-b-0">
            <div className="border-b border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
              Level {level}
            </div>
            <div className="divide-y divide-zinc-800">
              {levelNodes.map((node) => (
                <div key={node.id} className="px-3 py-3">
                  <div className="spec-body">{node.label}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                    <span>{node.nodeType}</span>
                    <span>{node.kind}</span>
                    <span>{node.confidence}</span>
                    <span>{node.sourceCount} src</span>
                    {node.parentId ? <span>parent {node.parentId}</span> : null}
                    {node.lastObservedAt ? <span>seen {formatDate(node.lastObservedAt)}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
        {edges.map((edge) => (
          <div key={edge.id} className="px-3 py-3">
            <div className="spec-body">
              {edge.from} → {edge.to}
            </div>
            <div className="spec-cell-label mt-1">
              {edge.edgeType} • {edge.kind} • {edge.confidence} • {edge.sourceCount} src
              {edge.lastObservedAt ? ` • seen ${formatDate(edge.lastObservedAt)}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IssuesPanel({ issues }: { issues: IssueRecord[] }) {
  return (
    <div className="divide-y divide-zinc-700 border border-zinc-700 bg-[#090909]">
      {issues.length > 0 ? (
        issues.map((issue) => (
          <div key={issue.id} className="px-3 py-3">
            <div className="spec-body">{issue.title}</div>
            <div className="spec-cell-label mt-1">
              {issue.category} • {issue.confidence} • {formatDate(issue.observedAt)}
            </div>
          </div>
        ))
      ) : (
        <div className="px-3 py-3 spec-body">No issues.</div>
      )}
    </div>
  );
}
