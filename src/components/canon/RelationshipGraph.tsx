"use client";

import { useMemo, useState } from "react";
import type { CanonAsset, CanonLayer } from "@/types/canon";
import {
  createRelationshipEngine,
  type InferredRelationship,
  type ControlLoop,
} from "@/lib/relationship-inference";

interface RelationshipGraphProps {
  assets: Partial<CanonAsset>[];
  selectedAssetId?: string;
  onAssetSelect?: (asset: Partial<CanonAsset>) => void;
}

const LAYER_COLORS: Record<CanonLayer, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#ca8a04",
  4: "#16a34a",
  5: "#2563eb",
  6: "#7c3aed",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  controls: "#dc2626",
  monitors: "#ea580c",
  protects: "#16a34a",
  connects_to: "#2563eb",
  accesses: "#7c3aed",
  depends_on: "#6b7280",
};

export default function RelationshipGraph({
  assets,
  selectedAssetId,
  onAssetSelect,
}: RelationshipGraphProps) {
  const [viewMode, setViewMode] = useState<"graph" | "loops" | "paths">("graph");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [hoveredRelationship, setHoveredRelationship] = useState<InferredRelationship | null>(null);

  // Create inference engine
  const engine = useMemo(() => createRelationshipEngine(assets), [assets]);
  const relationships = useMemo(() => engine.inferAllRelationships(), [engine]);
  const loops = useMemo(() => engine.inferControlLoops(), [engine]);
  const summary = useMemo(() => engine.getSummary(), [engine]);

  // Filter relationships by type
  const filteredRelationships = filterType
    ? relationships.filter((r) => r.relationshipType === filterType)
    : relationships;

  // Position nodes for visualization
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();

    // Group assets by layer
    const byLayer = new Map<CanonLayer, Partial<CanonAsset>[]>();
    for (const asset of assets) {
      const layer = (asset.layer || 3) as CanonLayer;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer)!.push(asset);
    }

    // Position by layer (radial layout)
    const centerX = 400;
    const centerY = 300;

    for (const [layer, layerAssets] of byLayer) {
      const radius = 50 + layer * 40;
      const angleStep = (2 * Math.PI) / Math.max(layerAssets.length, 1);

      layerAssets.forEach((asset, i) => {
        const angle = i * angleStep - Math.PI / 2;
        positions.set(asset.id!, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });
    }

    return positions;
  }, [assets]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Inferred Relationships
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === "graph"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode("loops")}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === "loops"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              Control Loops
            </button>
            <button
              onClick={() => setViewMode("paths")}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === "paths"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              Attack Paths
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.totalRelationships}
            </div>
            <div className="text-gray-500">Relationships</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {summary.controlLoops.complete}
            </div>
            <div className="text-gray-500">Complete Loops</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {summary.controlLoops.partial}
            </div>
            <div className="text-gray-500">Partial Loops</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {summary.networkCoverage.percentage}%
            </div>
            <div className="text-gray-500">Network Coverage</div>
          </div>
        </div>
      </div>

      {/* Relationship Type Filter */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType(null)}
          className={`px-2 py-1 text-xs rounded ${
            !filterType ? "bg-gray-900 text-white" : "bg-gray-200"
          }`}
        >
          All ({relationships.length})
        </button>
        {Object.entries(summary.byRelationshipType).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              filterType === type ? "ring-2 ring-offset-1" : ""
            }`}
            style={{
              backgroundColor: `${RELATIONSHIP_COLORS[type]}20`,
              color: RELATIONSHIP_COLORS[type],
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: RELATIONSHIP_COLORS[type] }}
            />
            {type.replace("_", " ")} ({count})
          </button>
        ))}
      </div>

      {/* Visualization Area */}
      <div className="p-4">
        {viewMode === "graph" && (
          <div className="overflow-auto">
            <svg width={800} height={600} className="border border-gray-200 rounded">
              {/* Layer rings */}
              {[1, 2, 3, 4, 5, 6].map((layer) => (
                <circle
                  key={`ring-${layer}`}
                  cx={400}
                  cy={300}
                  r={50 + layer * 40}
                  fill="none"
                  stroke={`${LAYER_COLORS[layer as CanonLayer]}30`}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              ))}

              {/* Relationship edges */}
              {filteredRelationships.map((rel, i) => {
                const from = nodePositions.get(rel.sourceId);
                const to = nodePositions.get(rel.targetId);
                if (!from || !to) return null;

                const isHovered = hoveredRelationship?.sourceId === rel.sourceId &&
                  hoveredRelationship?.targetId === rel.targetId;

                return (
                  <g key={`rel-${i}`}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={RELATIONSHIP_COLORS[rel.relationshipType] || "#6b7280"}
                      strokeWidth={isHovered ? 3 : 1.5}
                      opacity={isHovered ? 1 : 0.5}
                      markerEnd="url(#arrowhead)"
                      onMouseEnter={() => setHoveredRelationship(rel)}
                      onMouseLeave={() => setHoveredRelationship(null)}
                      className="cursor-pointer"
                    />
                  </g>
                );
              })}

              {/* Arrow marker definition */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                </marker>
              </defs>

              {/* Asset nodes */}
              {assets.map((asset) => {
                const pos = nodePositions.get(asset.id!);
                if (!pos) return null;

                const isSelected = asset.id === selectedAssetId;
                const hasRelationship = filteredRelationships.some(
                  (r) => r.sourceId === asset.id || r.targetId === asset.id
                );

                return (
                  <g
                    key={asset.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => onAssetSelect?.(asset)}
                    className="cursor-pointer"
                    opacity={filterType && !hasRelationship ? 0.3 : 1}
                  >
                    <circle
                      r={isSelected ? 18 : 12}
                      fill={LAYER_COLORS[(asset.layer || 3) as CanonLayer]}
                      stroke={isSelected ? "#000" : "white"}
                      strokeWidth={isSelected ? 3 : 1}
                    />
                    <text
                      y={25}
                      textAnchor="middle"
                      fontSize={8}
                      fill="#374151"
                    >
                      {asset.tagNumber}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hovered relationship tooltip */}
            {hoveredRelationship && (
              <div className="absolute bg-gray-900 text-white text-xs p-2 rounded shadow-lg max-w-xs">
                <div className="font-bold">
                  {hoveredRelationship.sourceTag} → {hoveredRelationship.targetTag}
                </div>
                <div className="opacity-75">{hoveredRelationship.relationshipType}</div>
                <div className="mt-1">{hoveredRelationship.description}</div>
                <div className="mt-1 text-gray-400">
                  Confidence: {hoveredRelationship.confidence}% ({hoveredRelationship.inferenceMethod})
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === "loops" && (
          <div className="space-y-4">
            {loops.map((loop) => (
              <ControlLoopCard key={loop.id} loop={loop} onAssetSelect={onAssetSelect} assets={assets} />
            ))}
          </div>
        )}

        {viewMode === "paths" && (
          <AttackPathView assets={assets} engine={engine} onAssetSelect={onAssetSelect} />
        )}
      </div>

      {/* Relationship List */}
      {viewMode === "graph" && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 max-h-64 overflow-auto">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Relationship Details ({filteredRelationships.length})
          </h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2">From</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">To</th>
                <th className="pb-2">Confidence</th>
                <th className="pb-2">Method</th>
              </tr>
            </thead>
            <tbody>
              {filteredRelationships.slice(0, 20).map((rel, i) => (
                <tr
                  key={i}
                  className="border-t border-gray-100 dark:border-gray-700"
                  onMouseEnter={() => setHoveredRelationship(rel)}
                  onMouseLeave={() => setHoveredRelationship(null)}
                >
                  <td className="py-1 font-mono">{rel.sourceTag}</td>
                  <td className="py-1">
                    <span
                      className="px-1 rounded"
                      style={{
                        backgroundColor: `${RELATIONSHIP_COLORS[rel.relationshipType]}20`,
                        color: RELATIONSHIP_COLORS[rel.relationshipType],
                      }}
                    >
                      {rel.relationshipType}
                    </span>
                  </td>
                  <td className="py-1 font-mono">{rel.targetTag}</td>
                  <td className="py-1">{rel.confidence}%</td>
                  <td className="py-1 text-gray-500">{rel.inferenceMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRelationships.length > 20 && (
            <p className="text-gray-500 text-xs mt-2">
              Showing 20 of {filteredRelationships.length} relationships
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Control Loop Card Component
function ControlLoopCard({
  loop,
  onAssetSelect,
  assets,
}: {
  loop: ControlLoop;
  onAssetSelect?: (asset: Partial<CanonAsset>) => void;
  assets: Partial<CanonAsset>[];
}) {
  const getAsset = (id: string) => assets.find((a) => a.id === id);

  return (
    <div
      className={`p-4 rounded-lg border-l-4 ${
        loop.status === "complete"
          ? "bg-green-50 border-green-500"
          : loop.status === "partial"
            ? "bg-yellow-50 border-yellow-500"
            : "bg-red-50 border-red-500"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono font-bold text-gray-900">
            Loop {loop.loopNumber}
          </span>
          <span className="ml-2 text-sm text-gray-600">
            {loop.variableName}
          </span>
          {loop.processArea && (
            <span className="ml-2 text-xs text-gray-500">
              ({loop.processArea})
            </span>
          )}
        </div>
        <span
          className={`px-2 py-1 text-xs rounded ${
            loop.status === "complete"
              ? "bg-green-200 text-green-800"
              : loop.status === "partial"
                ? "bg-yellow-200 text-yellow-800"
                : "bg-red-200 text-red-800"
          }`}
        >
          {loop.status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        {/* Sensor */}
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Sensor</div>
          {loop.sensor ? (
            <button
              onClick={() => onAssetSelect?.(getAsset(loop.sensor!.id)!)}
              className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm font-mono hover:bg-orange-200"
            >
              {loop.sensor.tag}
            </button>
          ) : (
            <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm">
              Missing
            </span>
          )}
        </div>

        <span className="text-gray-400">→</span>

        {/* Controller */}
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Controller</div>
          {loop.controller ? (
            <button
              onClick={() => onAssetSelect?.(getAsset(loop.controller!.id)!)}
              className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-mono hover:bg-yellow-200"
            >
              {loop.controller.tag}
            </button>
          ) : (
            <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm">
              Missing
            </span>
          )}
        </div>

        <span className="text-gray-400">→</span>

        {/* Actuator */}
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Actuator</div>
          {loop.actuator ? (
            <button
              onClick={() => onAssetSelect?.(getAsset(loop.actuator!.id)!)}
              className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-mono hover:bg-red-200"
            >
              {loop.actuator.tag}
            </button>
          ) : (
            <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-sm">
              Missing
            </span>
          )}
        </div>

        {/* Network indicator */}
        <div className="ml-2">
          {loop.networkConnected ? (
            <span className="text-blue-500" title="Network connected">🌐</span>
          ) : (
            <span className="text-gray-400" title="Not networked">⚡</span>
          )}
        </div>
      </div>

      {loop.missingElements.length > 0 && (
        <div className="mt-2 text-xs text-red-600">
          Missing: {loop.missingElements.join(", ")}
        </div>
      )}
    </div>
  );
}

// Attack Path View Component
function AttackPathView({
  assets,
  engine,
  onAssetSelect,
}: {
  assets: Partial<CanonAsset>[];
  engine: ReturnType<typeof createRelationshipEngine>;
  onAssetSelect?: (asset: Partial<CanonAsset>) => void;
}) {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  // Find entry points (Layer 6, VPN, remote access)
  const entryPoints = assets.filter(
    (a) =>
      a.layer === 6 ||
      a.assetType === "vpn_concentrator" ||
      a.network?.remoteAccessExposure
  );

  // Build consequence chain for selected entry
  const chain = selectedEntry ? engine.buildConsequenceChain(selectedEntry) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">Entry Point:</span>
        {entryPoints.map((ep) => (
          <button
            key={ep.id}
            onClick={() => setSelectedEntry(ep.id!)}
            className={`px-3 py-1 text-sm rounded ${
              selectedEntry === ep.id
                ? "bg-purple-500 text-white"
                : "bg-purple-100 text-purple-800 hover:bg-purple-200"
            }`}
          >
            {ep.tagNumber}
          </button>
        ))}
      </div>

      {chain && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Consequence Chain from {chain.trigger.tagNumber}
          </h4>

          <div className="space-y-2">
            {/* Trigger */}
            <div className="flex items-center gap-2">
              <span className="w-20 text-xs text-gray-500">Entry</span>
              <button
                onClick={() => onAssetSelect?.(chain.trigger)}
                className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-mono"
              >
                {chain.trigger.tagNumber}
              </button>
            </div>

            {/* Chain steps */}
            {chain.chain.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-20 text-xs text-gray-500">
                  Step {i + 1}
                </span>
                <span className="text-gray-400">↓</span>
                <button
                  onClick={() => onAssetSelect?.(step.asset)}
                  className={`px-2 py-1 rounded text-sm font-mono ${
                    step.severity === "critical"
                      ? "bg-red-100 text-red-800"
                      : step.severity === "high"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {step.asset.tagNumber}
                </button>
                <span className="text-xs text-gray-500">{step.event}</span>
              </div>
            ))}

            {/* Ultimate consequence */}
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="text-xs text-red-600 mb-1">Ultimate Consequence</div>
              <div className="text-red-800 font-medium">
                {chain.ultimateConsequence}
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedEntry && (
        <div className="p-4 text-center text-gray-500">
          Select an entry point to trace attack path
        </div>
      )}
    </div>
  );
}
