"use client";

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import type { CanonAsset } from "@/types/canon";

// Equipment 3D representations based on type
interface Equipment3DProps {
  asset: Partial<CanonAsset>;
  position: [number, number, number];
  selected: boolean;
  onSelect: (asset: Partial<CanonAsset>) => void;
  colorMode: "layer" | "risk" | "process";
}

// Color schemes
const LAYER_COLORS: Record<number, string> = {
  1: "#3b82f6", // Blue - Physical
  2: "#22c55e", // Green - Instrumentation
  3: "#f59e0b", // Orange - Control
  4: "#8b5cf6", // Purple - Operations
  5: "#ef4444", // Red - Network
  6: "#6b7280", // Gray - Enterprise
};

const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const PROCESS_COLORS: Record<string, string> = {
  Reaction: "#ef4444",
  Separation: "#3b82f6",
  Storage: "#22c55e",
  Utilities: "#8b5cf6",
  "Feed Preparation": "#f59e0b",
  "Product Finishing": "#ec4899",
};

function getEquipmentColor(
  asset: Partial<CanonAsset>,
  colorMode: "layer" | "risk" | "process"
): string {
  if (colorMode === "layer") {
    return LAYER_COLORS[asset.layer || 1] || "#6b7280";
  }
  if (colorMode === "risk") {
    return RISK_COLORS[asset.security?.riskTier || "low"] || "#22c55e";
  }
  if (colorMode === "process") {
    const area = asset.engineering?.processArea || "Utilities";
    return PROCESS_COLORS[area] || "#6b7280";
  }
  return "#6b7280";
}

// Column/Tower - tall vertical cylinder
function Column({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current && selected) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <mesh ref={meshRef} position={position} onClick={onClick}>
      <cylinderGeometry args={[0.4, 0.5, 3, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={selected ? color : "#000000"}
        emissiveIntensity={selected ? 0.3 : 0}
      />
    </mesh>
  );
}

// Reactor - sphere or vertical vessel
function Reactor({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current && selected) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group position={position} onClick={onClick}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.6, 0.6, 1.5, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      {/* Top dome */}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Bottom dome */}
      <mesh position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// Vessel/Tank - horizontal cylinder
function Vessel({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 1.2, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      {/* End caps */}
      <mesh position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// Pump - small box with cylinder
function Pump({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// Heat Exchanger - shell and tube representation
function HeatExchanger({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 1.5, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      {/* Channel heads */}
      <mesh position={[0.85, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.85, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// Controller/PLC - box with lights
function Controller({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <boxGeometry args={[0.4, 0.6, 0.2]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      {/* Status lights */}
      <mesh position={[0.1, 0.2, 0.11]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.1, 0.2, 0.11]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// Sensor/Transmitter - small cylinder with stem
function Sensor({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.15, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
    </group>
  );
}

// Valve - butterfly style
function Valve({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.04, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.15, 8]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
    </group>
  );
}

// Generic equipment fallback
function GenericEquipment({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial
        color={color}
        emissive={selected ? color : "#000000"}
        emissiveIntensity={selected ? 0.3 : 0}
      />
    </mesh>
  );
}

// Equipment wrapper that selects the right shape
function Equipment3D({ asset, position, selected, onSelect, colorMode }: Equipment3DProps) {
  const color = getEquipmentColor(asset, colorMode);
  const handleClick = () => onSelect(asset);

  const type = asset.assetType || "";

  if (type === "column" || type.includes("column")) {
    return <Column position={position} color={color} selected={selected} onClick={handleClick} />;
  }
  if (type === "reactor" || type.includes("reactor")) {
    return <Reactor position={position} color={color} selected={selected} onClick={handleClick} />;
  }
  if (type === "vessel" || type === "tank" || type.includes("tank") || type.includes("vessel")) {
    return <Vessel position={position} color={color} selected={selected} onClick={handleClick} />;
  }
  if (type === "pump" || type.includes("pump")) {
    return <Pump position={position} color={color} selected={selected} onClick={handleClick} />;
  }
  if (type === "heat_exchanger" || type.includes("exchanger") || type.includes("cooler") || type.includes("heater")) {
    return <HeatExchanger position={position} color={color} selected={selected} onClick={handleClick} />;
  }
  if (type.includes("controller") || type === "plc" || type === "dcs_controller" || type === "safety_controller") {
    return <Controller position={position} color={color} selected={selected} onClick={handleClick} />;
  }
  if (type.includes("sensor") || type.includes("transmitter") || type.includes("_sensor")) {
    return <Sensor position={position} color={color} selected={selected} onClick={handleClick} />;
  }
  if (type.includes("valve")) {
    return <Valve position={position} color={color} selected={selected} onClick={handleClick} />;
  }

  return <GenericEquipment position={position} color={color} selected={selected} onClick={handleClick} />;
}

// Pipe connection between two points
function Pipe({ start, end, color = "#888888" }: {
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
}) {
  const points = useMemo(() => {
    const midY = Math.max(start[1], end[1]) + 0.5;
    return [
      new THREE.Vector3(...start),
      new THREE.Vector3(start[0], midY, start[2]),
      new THREE.Vector3(end[0], midY, end[2]),
      new THREE.Vector3(...end),
    ];
  }, [start, end]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
      segments
    />
  );
}

// Process area label
function AreaLabel({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Text
      position={position}
      fontSize={0.4}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
    >
      {text}
    </Text>
  );
}

// Floor grid
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
}

// Grid helper
function Grid() {
  return <gridHelper args={[50, 50, "#333355", "#222244"]} position={[0, -1.99, 0]} />;
}

// Main scene
function PlantScene({
  assets,
  selectedAsset,
  onSelectAsset,
  colorMode,
}: {
  assets: Partial<CanonAsset>[];
  selectedAsset: Partial<CanonAsset> | null;
  onSelectAsset: (asset: Partial<CanonAsset> | null) => void;
  colorMode: "layer" | "risk" | "process";
}) {
  // Group assets by process area and calculate positions
  const { positions, connections, areaLabels } = useMemo(() => {
    const positions = new Map<string, [number, number, number]>();
    const connections: Array<{ from: string; to: string }> = [];
    const areaLabels: Array<{ position: [number, number, number]; text: string }> = [];

    // Define process area layout (X position)
    const areaXPositions: Record<string, number> = {
      "Feed Preparation": -12,
      "Reaction": -4,
      "Separation": 4,
      "Storage": 12,
      "Utilities": 0,
      "Product Finishing": 8,
    };

    // Group assets by process area
    const byArea = new Map<string, Partial<CanonAsset>[]>();
    for (const asset of assets) {
      // Only show Layer 1-3 equipment in 3D view
      if ((asset.layer || 0) > 3) continue;

      const area = asset.engineering?.processArea || "Utilities";
      if (!byArea.has(area)) {
        byArea.set(area, []);
      }
      byArea.get(area)!.push(asset);
    }

    // Position assets within each area
    for (const [area, areaAssets] of byArea) {
      const baseX = areaXPositions[area] || 0;

      // Add area label
      areaLabels.push({
        position: [baseX, 4, -5],
        text: area,
      });

      // Sort by asset type for visual grouping
      const sorted = [...areaAssets].sort((a, b) => {
        const typeOrder: Record<string, number> = {
          reactor: 0,
          column: 1,
          vessel: 2,
          tank: 3,
          heat_exchanger: 4,
          pump: 5,
          plc: 6,
          dcs_controller: 6,
          safety_controller: 6,
        };
        const aOrder = typeOrder[a.assetType || ""] ?? 10;
        const bOrder = typeOrder[b.assetType || ""] ?? 10;
        return aOrder - bOrder;
      });

      // Position in a grid within the area
      const cols = Math.ceil(Math.sqrt(sorted.length));
      sorted.forEach((asset, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;

        // Determine Y based on equipment type
        let y = 0;
        const type = asset.assetType || "";
        if (type === "column") y = 1.5;
        else if (type === "reactor") y = 0.75;
        else if (type.includes("sensor") || type.includes("valve")) y = -0.5;
        else if (type.includes("controller") || type === "plc") y = 0.3;

        const x = baseX + (col - cols / 2) * 2;
        const z = row * 2.5 - 3;

        positions.set(asset.id || asset.tagNumber || `${idx}`, [x, y, z]);
      });
    }

    // Create connections based on process flow (simplified)
    // In reality, this would come from actual P&ID data
    const reactors = assets.filter(a => a.assetType === "reactor");
    const columns = assets.filter(a => a.assetType === "column");
    const tanks = assets.filter(a => a.assetType === "tank" || a.assetType === "vessel");

    // Connect reactors to columns (reaction -> separation)
    for (const reactor of reactors) {
      for (const column of columns.slice(0, 1)) { // Connect to first column
        const fromId = reactor.id || reactor.tagNumber;
        const toId = column.id || column.tagNumber;
        if (fromId && toId && positions.has(fromId) && positions.has(toId)) {
          connections.push({ from: fromId, to: toId });
        }
      }
    }

    return { positions, connections, areaLabels };
  }, [assets]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.3} />

      {/* Floor and grid */}
      <Floor />
      <Grid />

      {/* Area labels */}
      {areaLabels.map((label, idx) => (
        <AreaLabel key={idx} position={label.position} text={label.text} />
      ))}

      {/* Equipment */}
      {assets
        .filter(a => (a.layer || 0) <= 3 && positions.has(a.id || a.tagNumber || ""))
        .map((asset) => {
          const id = asset.id || asset.tagNumber || "";
          const position = positions.get(id);
          if (!position) return null;

          return (
            <group key={id}>
              <Equipment3D
                asset={asset}
                position={position}
                selected={selectedAsset?.id === asset.id || selectedAsset?.tagNumber === asset.tagNumber}
                onSelect={onSelectAsset}
                colorMode={colorMode}
              />
              {/* Tag label */}
              <Html position={[position[0], position[1] + 1.5, position[2]]} center>
                <div className="text-xs text-white bg-black/50 px-1 rounded whitespace-nowrap">
                  {asset.tagNumber}
                </div>
              </Html>
            </group>
          );
        })}

      {/* Pipe connections */}
      {connections.map((conn, idx) => {
        const start = positions.get(conn.from);
        const end = positions.get(conn.to);
        if (!start || !end) return null;
        return <Pipe key={idx} start={start} end={end} />;
      })}

      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

// Main component
export default function Plant3DView({ assets }: { assets: Partial<CanonAsset>[] }) {
  const [selectedAsset, setSelectedAsset] = useState<Partial<CanonAsset> | null>(null);
  const [colorMode, setColorMode] = useState<"layer" | "risk" | "process">("process");

  return (
    <div className="relative w-full h-[600px] bg-gray-900 rounded-lg overflow-hidden">
      {/* Controls overlay */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <select
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value as "layer" | "risk" | "process")}
          className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded border border-gray-700"
        >
          <option value="process">Color by Process Area</option>
          <option value="layer">Color by Purdue Layer</option>
          <option value="risk">Color by Risk Tier</option>
        </select>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-gray-800/90 p-3 rounded text-xs">
        <div className="text-gray-400 mb-2 font-medium">
          {colorMode === "process" ? "Process Areas" : colorMode === "layer" ? "Purdue Layers" : "Risk Tiers"}
        </div>
        {colorMode === "process" && (
          <div className="space-y-1">
            {Object.entries(PROCESS_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-white">{name}</span>
              </div>
            ))}
          </div>
        )}
        {colorMode === "layer" && (
          <div className="space-y-1">
            {Object.entries(LAYER_COLORS).map(([layer, color]) => (
              <div key={layer} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-white">L{layer}</span>
              </div>
            ))}
          </div>
        )}
        {colorMode === "risk" && (
          <div className="space-y-1">
            {Object.entries(RISK_COLORS).map(([tier, color]) => (
              <div key={tier} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-white capitalize">{tier}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10 text-gray-400 text-xs">
        Drag to rotate | Scroll to zoom | Click equipment for details
      </div>

      {/* Selected asset panel */}
      {selectedAsset && (
        <div className="absolute bottom-4 right-4 z-10 bg-gray-800/95 p-4 rounded-lg w-72 border border-gray-700">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-mono font-bold text-white">{selectedAsset.tagNumber}</div>
              <div className="text-sm text-gray-400">{selectedAsset.name}</div>
            </div>
            <button
              onClick={() => setSelectedAsset(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="text-white">{selectedAsset.assetType?.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Layer</span>
              <span className="text-white">L{selectedAsset.layer}</span>
            </div>
            {selectedAsset.engineering?.processArea && (
              <div className="flex justify-between">
                <span className="text-gray-500">Process Area</span>
                <span className="text-white">{selectedAsset.engineering.processArea}</span>
              </div>
            )}
            {selectedAsset.security?.riskTier && (
              <div className="flex justify-between">
                <span className="text-gray-500">Risk Tier</span>
                <span className={`capitalize ${
                  selectedAsset.security.riskTier === "critical" ? "text-red-400" :
                  selectedAsset.security.riskTier === "high" ? "text-orange-400" :
                  selectedAsset.security.riskTier === "medium" ? "text-yellow-400" :
                  "text-green-400"
                }`}>
                  {selectedAsset.security.riskTier}
                </span>
              </div>
            )}
            {selectedAsset.network?.ipAddress && (
              <div className="flex justify-between">
                <span className="text-gray-500">IP Address</span>
                <span className="text-white font-mono text-xs">{selectedAsset.network.ipAddress}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [15, 15, 15], fov: 50 }}
        shadows
      >
        <Suspense fallback={null}>
          <PlantScene
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
            colorMode={colorMode}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
