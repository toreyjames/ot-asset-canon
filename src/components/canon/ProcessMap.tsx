"use client";

import { useMemo, useState } from "react";
import type { CanonAsset, CanonLayer } from "@/types/canon";

interface ProcessMapProps {
  assets: Partial<CanonAsset>[];
  onAssetClick?: (asset: Partial<CanonAsset>) => void;
  highlightGaps?: boolean;
  showNetworkOverlay?: boolean;
}

// Position assets in a process flow layout
interface PositionedAsset extends Partial<CanonAsset> {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Group assets by process area and layer
function layoutAssets(assets: Partial<CanonAsset>[]): PositionedAsset[] {
  const positioned: PositionedAsset[] = [];

  // Group by process area
  const processAreas = new Map<string, Partial<CanonAsset>[]>();
  const noArea: Partial<CanonAsset>[] = [];

  for (const asset of assets) {
    const area = asset.engineering?.processArea || "Unknown";
    if (area === "Unknown") {
      noArea.push(asset);
    } else {
      if (!processAreas.has(area)) {
        processAreas.set(area, []);
      }
      processAreas.get(area)!.push(asset);
    }
  }

  // Layout each process area as a column
  let areaX = 50;
  const areaWidth = 200;
  const areaGap = 50;

  for (const [area, areaAssets] of processAreas) {
    // Sort by layer (1 at bottom, 6 at top)
    const sorted = [...areaAssets].sort((a, b) => (a.layer || 3) - (b.layer || 3));

    // Position within area
    const layerHeight = 80;
    const assetGap = 20;

    // Group by layer within area
    const byLayer = new Map<CanonLayer, Partial<CanonAsset>[]>();
    for (const asset of sorted) {
      const layer = (asset.layer || 3) as CanonLayer;
      if (!byLayer.has(layer)) {
        byLayer.set(layer, []);
      }
      byLayer.get(layer)!.push(asset);
    }

    for (const [layer, layerAssets] of byLayer) {
      const baseY = 500 - (layer * layerHeight);
      let assetX = areaX;

      for (const asset of layerAssets) {
        const width = getAssetWidth(asset.assetType as string);
        const height = getAssetHeight(asset.assetType as string);

        positioned.push({
          ...asset,
          x: assetX,
          y: baseY,
          width,
          height,
        });

        assetX += width + assetGap;
      }
    }

    areaX += areaWidth + areaGap;
  }

  // Handle assets with no process area
  if (noArea.length > 0) {
    let y = 100;
    for (const asset of noArea) {
      positioned.push({
        ...asset,
        x: areaX,
        y,
        width: 60,
        height: 40,
      });
      y += 50;
    }
  }

  return positioned;
}

function getAssetWidth(assetType: string): number {
  const widths: Record<string, number> = {
    reactor: 80,
    tank: 60,
    column: 40,
    heat_exchanger: 70,
    pump: 40,
    compressor: 50,
    control_valve: 30,
    temperature_sensor: 25,
    pressure_sensor: 25,
    flow_sensor: 25,
    level_sensor: 25,
    plc: 60,
    dcs_controller: 70,
    hmi: 60,
    switch: 50,
  };
  return widths[assetType] || 40;
}

function getAssetHeight(assetType: string): number {
  const heights: Record<string, number> = {
    reactor: 100,
    tank: 80,
    column: 120,
    heat_exchanger: 40,
    pump: 30,
    compressor: 40,
    control_valve: 20,
    temperature_sensor: 20,
    pressure_sensor: 20,
    flow_sensor: 20,
    level_sensor: 20,
    plc: 50,
    dcs_controller: 50,
    hmi: 40,
    switch: 30,
  };
  return heights[assetType] || 30;
}

// Layer colors
const LAYER_COLORS: Record<CanonLayer, string> = {
  1: "#dc2626", // Physical - Red
  2: "#ea580c", // Instrumentation - Orange
  3: "#ca8a04", // Control - Yellow
  4: "#16a34a", // Operations - Green
  5: "#2563eb", // Network - Blue
  6: "#7c3aed", // Enterprise - Purple
};

const LAYER_NAMES: Record<CanonLayer, string> = {
  1: "Physical Process",
  2: "Instrumentation",
  3: "Control Systems",
  4: "Operations",
  5: "Network",
  6: "Enterprise",
};

export default function ProcessMap({
  assets,
  onAssetClick,
  highlightGaps = false,
  showNetworkOverlay = false,
}: ProcessMapProps) {
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<CanonLayer | null>(null);

  // Layout assets
  const positionedAssets = useMemo(() => layoutAssets(assets), [assets]);

  // Calculate SVG dimensions
  const maxX = Math.max(...positionedAssets.map((a) => a.x + a.width), 800);
  const maxY = 600;

  // Get unique process areas for labels
  const processAreas = useMemo(() => {
    const areas = new Set<string>();
    for (const asset of assets) {
      if (asset.engineering?.processArea) {
        areas.add(asset.engineering.processArea);
      }
    }
    return Array.from(areas);
  }, [assets]);

  // Find connections (simplified - assets in same process area at adjacent layers)
  const connections = useMemo(() => {
    const conns: { from: PositionedAsset; to: PositionedAsset }[] = [];

    for (const asset of positionedAssets) {
      // Find assets one layer up in same process area
      const upperLayer = positionedAssets.filter(
        (a) =>
          a.layer === (asset.layer || 0) + 1 &&
          a.engineering?.processArea === asset.engineering?.processArea
      );

      for (const upper of upperLayer) {
        conns.push({ from: asset, to: upper });
      }
    }

    return conns;
  }, [positionedAssets]);

  // Filter by selected layer
  const visibleAssets = selectedLayer
    ? positionedAssets.filter((a) => a.layer === selectedLayer)
    : positionedAssets;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Process Map
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filter by layer:</span>
          <button
            onClick={() => setSelectedLayer(null)}
            className={`px-2 py-1 text-xs rounded ${
              !selectedLayer ? "bg-gray-900 text-white" : "bg-gray-200"
            }`}
          >
            All
          </button>
          {([1, 2, 3, 4, 5, 6] as CanonLayer[]).map((layer) => (
            <button
              key={layer}
              onClick={() => setSelectedLayer(layer)}
              className="px-2 py-1 text-xs rounded text-white"
              style={{
                backgroundColor:
                  selectedLayer === layer ? LAYER_COLORS[layer] : `${LAYER_COLORS[layer]}80`,
              }}
            >
              L{layer}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        {([1, 2, 3, 4, 5, 6] as CanonLayer[]).map((layer) => (
          <div key={layer} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: LAYER_COLORS[layer] }}
            />
            <span className="text-gray-600 dark:text-gray-400">
              L{layer}: {LAYER_NAMES[layer]}
            </span>
          </div>
        ))}
      </div>

      {/* SVG Map */}
      <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
        <svg
          width={maxX + 100}
          height={maxY + 50}
          viewBox={`0 0 ${maxX + 100} ${maxY + 50}`}
          className="min-w-full"
        >
          {/* Layer bands */}
          {([1, 2, 3, 4, 5, 6] as CanonLayer[]).map((layer) => (
            <g key={`layer-band-${layer}`}>
              <rect
                x={0}
                y={500 - layer * 80 - 30}
                width={maxX + 100}
                height={80}
                fill={`${LAYER_COLORS[layer]}10`}
                stroke={`${LAYER_COLORS[layer]}30`}
                strokeWidth={1}
              />
              <text
                x={10}
                y={500 - layer * 80 + 10}
                fill={LAYER_COLORS[layer]}
                fontSize={10}
                opacity={0.7}
              >
                L{layer}
              </text>
            </g>
          ))}

          {/* Connections */}
          {!selectedLayer &&
            connections.map((conn, i) => (
              <line
                key={`conn-${i}`}
                x1={conn.from.x + conn.from.width / 2}
                y1={conn.from.y}
                x2={conn.to.x + conn.to.width / 2}
                y2={conn.to.y + conn.to.height}
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="4,2"
                opacity={0.5}
              />
            ))}

          {/* Network overlay connections */}
          {showNetworkOverlay &&
            visibleAssets
              .filter((a) => a.network?.ipAddress)
              .map((asset, i, arr) => {
                if (i === 0) return null;
                const prev = arr[i - 1];
                return (
                  <line
                    key={`network-${i}`}
                    x1={prev.x + prev.width / 2}
                    y1={prev.y + prev.height / 2}
                    x2={asset.x + asset.width / 2}
                    y2={asset.y + asset.height / 2}
                    stroke="#2563eb"
                    strokeWidth={2}
                    opacity={0.3}
                  />
                );
              })}

          {/* Assets */}
          {visibleAssets.map((asset) => (
            <g
              key={asset.id}
              transform={`translate(${asset.x}, ${asset.y})`}
              onClick={() => onAssetClick?.(asset)}
              onMouseEnter={() => setHoveredAsset(asset.id || null)}
              onMouseLeave={() => setHoveredAsset(null)}
              className="cursor-pointer"
            >
              {/* Asset shape */}
              <AssetShape
                assetType={asset.assetType as string}
                width={asset.width}
                height={asset.height}
                layer={asset.layer as CanonLayer}
                isHovered={hoveredAsset === asset.id}
                hasNetwork={!!asset.network?.ipAddress}
                riskTier={asset.security?.riskTier}
              />

              {/* Tag number */}
              <text
                x={asset.width / 2}
                y={asset.height + 12}
                textAnchor="middle"
                fontSize={8}
                fill="#374151"
                className="pointer-events-none"
              >
                {asset.tagNumber}
              </text>

              {/* Network indicator */}
              {showNetworkOverlay && asset.network?.ipAddress && (
                <circle
                  cx={asset.width - 5}
                  cy={5}
                  r={4}
                  fill="#2563eb"
                  stroke="#fff"
                  strokeWidth={1}
                />
              )}

              {/* Risk indicator */}
              {asset.security?.riskTier === "critical" && (
                <circle
                  cx={5}
                  cy={5}
                  r={4}
                  fill="#dc2626"
                  stroke="#fff"
                  strokeWidth={1}
                />
              )}
            </g>
          ))}

          {/* Tooltip */}
          {hoveredAsset && (
            <g>
              {(() => {
                const asset = positionedAssets.find((a) => a.id === hoveredAsset);
                if (!asset) return null;
                return (
                  <foreignObject
                    x={asset.x + asset.width + 10}
                    y={asset.y}
                    width={200}
                    height={100}
                  >
                    <div className="bg-gray-900 text-white text-xs p-2 rounded shadow-lg">
                      <div className="font-bold">{asset.tagNumber}</div>
                      <div className="opacity-75">{asset.name}</div>
                      <div className="mt-1 text-gray-300">
                        {asset.assetType?.replace(/_/g, " ")}
                      </div>
                      {asset.network?.ipAddress && (
                        <div className="text-blue-300">IP: {asset.network.ipAddress}</div>
                      )}
                    </div>
                  </foreignObject>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {assets.length}
          </div>
          <div className="text-gray-500">Total Assets</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {processAreas.length}
          </div>
          <div className="text-gray-500">Process Areas</div>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
          <div className="text-2xl font-bold text-blue-600">
            {assets.filter((a) => a.network?.ipAddress).length}
          </div>
          <div className="text-gray-500">Network Connected</div>
        </div>
      </div>
    </div>
  );
}

// Asset shape components based on P&ID symbols
function AssetShape({
  assetType,
  width,
  height,
  layer,
  isHovered,
  hasNetwork,
  riskTier,
}: {
  assetType: string;
  width: number;
  height: number;
  layer: CanonLayer;
  isHovered: boolean;
  hasNetwork: boolean;
  riskTier?: string;
}) {
  const color = LAYER_COLORS[layer];
  const strokeWidth = isHovered ? 3 : 1.5;
  const opacity = isHovered ? 1 : 0.9;

  // Different shapes based on asset type
  switch (assetType) {
    case "reactor":
    case "tank":
      // Vertical vessel
      return (
        <g opacity={opacity}>
          <ellipse
            cx={width / 2}
            cy={10}
            rx={width / 2 - 2}
            ry={8}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <rect
            x={2}
            y={10}
            width={width - 4}
            height={height - 20}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <ellipse
            cx={width / 2}
            cy={height - 10}
            rx={width / 2 - 2}
            ry={8}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </g>
      );

    case "heat_exchanger":
      // Shell and tube
      return (
        <g opacity={opacity}>
          <ellipse
            cx={10}
            cy={height / 2}
            rx={8}
            ry={height / 2 - 2}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <rect
            x={10}
            y={2}
            width={width - 20}
            height={height - 4}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <ellipse
            cx={width - 10}
            cy={height / 2}
            rx={8}
            ry={height / 2 - 2}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </g>
      );

    case "pump":
      // Circle with triangle
      return (
        <g opacity={opacity}>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={height / 2 - 2}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <polygon
            points={`${width / 2 - 8},${height / 2 + 5} ${width / 2 + 8},${height / 2 + 5} ${width / 2},${height / 2 - 8}`}
            fill={color}
          />
        </g>
      );

    case "control_valve":
      // Bowtie
      return (
        <g opacity={opacity}>
          <polygon
            points={`0,0 ${width / 2},${height / 2} 0,${height}`}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <polygon
            points={`${width},0 ${width / 2},${height / 2} ${width},${height}`}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </g>
      );

    case "temperature_sensor":
    case "pressure_sensor":
    case "flow_sensor":
    case "level_sensor":
      // Circle with letter
      const letter = assetType[0].toUpperCase();
      return (
        <g opacity={opacity}>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={Math.min(width, height) / 2 - 2}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <text
            x={width / 2}
            y={height / 2 + 4}
            textAnchor="middle"
            fontSize={10}
            fill={color}
            fontWeight="bold"
          >
            {letter}
          </text>
        </g>
      );

    case "plc":
    case "dcs_controller":
    case "safety_plc":
      // Rectangle with internal lines (like a controller)
      return (
        <g opacity={opacity}>
          <rect
            x={2}
            y={2}
            width={width - 4}
            height={height - 4}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
            rx={3}
          />
          <line x1={10} y1={height / 3} x2={width - 10} y2={height / 3} stroke={color} strokeWidth={1} />
          <line x1={10} y1={(height * 2) / 3} x2={width - 10} y2={(height * 2) / 3} stroke={color} strokeWidth={1} />
        </g>
      );

    case "hmi":
      // Screen shape
      return (
        <g opacity={opacity}>
          <rect
            x={2}
            y={2}
            width={width - 4}
            height={height - 10}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
            rx={2}
          />
          <rect
            x={width / 3}
            y={height - 8}
            width={width / 3}
            height={6}
            fill={color}
          />
        </g>
      );

    case "switch":
    case "router":
    case "firewall":
      // Network device - hexagon-ish
      return (
        <g opacity={opacity}>
          <rect
            x={2}
            y={2}
            width={width - 4}
            height={height - 4}
            fill={`${color}30`}
            stroke={color}
            strokeWidth={strokeWidth}
            rx={2}
          />
          {[...Array(4)].map((_, i) => (
            <circle
              key={i}
              cx={8 + i * 12}
              cy={height - 8}
              r={3}
              fill={hasNetwork ? "#22c55e" : color}
            />
          ))}
        </g>
      );

    default:
      // Generic rectangle
      return (
        <rect
          x={2}
          y={2}
          width={width - 4}
          height={height - 4}
          fill={`${color}30`}
          stroke={color}
          strokeWidth={strokeWidth}
          rx={3}
          opacity={opacity}
        />
      );
  }
}
