"use client";

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import type { CanonAsset } from "@/types/canon";
import { analyzeProcessEngineering, type EngineeringObservation } from "@/lib/process-engineering-analysis";

// ============================================================================
// PROCESS FLOW LAYOUT ENGINE
// Position equipment based on actual process relationships, not asset types
// ============================================================================

interface ProcessUnit {
  id: string;
  name: string;
  assets: Partial<CanonAsset>[];
  position: [number, number, number];
  connections: string[]; // IDs of downstream units
}

interface EquipmentPosition {
  asset: Partial<CanonAsset>;
  position: [number, number, number];
  parentUnit?: string;
}

interface GapPosition {
  id: string;
  type: "reboiler" | "condenser" | "reflux_drum" | "feed_prep" | "finishing" | "catalyst" | "pump" | "generic";
  label: string;
  description: string;
  position: [number, number, number];
  severity: "critical" | "major" | "minor";
}

// Build process flow from assets
function buildProcessFlow(assets: Partial<CanonAsset>[]): {
  positions: Map<string, EquipmentPosition>;
  pipes: Array<{ from: [number, number, number]; to: [number, number, number]; color: string }>;
  units: ProcessUnit[];
  gaps: GapPosition[];
} {
  const positions = new Map<string, EquipmentPosition>();
  const pipes: Array<{ from: [number, number, number]; to: [number, number, number]; color: string }> = [];
  const gaps: GapPosition[] = [];

  // Step 1: Identify major equipment (the "anchors" of the process)
  const reactors = assets.filter(a => a.assetType === "reactor");
  const columns = assets.filter(a => a.assetType === "column");
  const vessels = assets.filter(a => a.assetType === "vessel" || a.assetType === "tank");
  const exchangers = assets.filter(a =>
    a.assetType === "heat_exchanger" ||
    a.name?.toLowerCase().includes("exchanger") ||
    a.name?.toLowerCase().includes("cooler") ||
    a.name?.toLowerCase().includes("heater") ||
    a.name?.toLowerCase().includes("condenser") ||
    a.name?.toLowerCase().includes("reboiler")
  );
  const pumps = assets.filter(a => a.assetType === "pump");
  const compressors = assets.filter(a => a.assetType === "compressor");

  // Step 2: Layout major process units along X axis (left to right = process flow)
  // Real plant layout: Feed -> Reaction -> Separation -> Product

  let xPos = -15;
  const zBase = 0;

  // === FEED SECTION (left side) ===
  const feedTanks = vessels.filter(a =>
    a.name?.toLowerCase().includes("feed") ||
    a.engineering?.processArea?.toLowerCase().includes("feed") ||
    a.tagNumber?.startsWith("TK-1")
  );

  for (const tank of feedTanks) {
    const id = tank.id || tank.tagNumber || "";
    positions.set(id, {
      asset: tank,
      position: [xPos, 0, zBase],
      parentUnit: "feed"
    });
    xPos += 3;
  }

  // Feed pumps near feed tanks
  const feedPumps = pumps.filter(a =>
    a.name?.toLowerCase().includes("feed") ||
    a.tagNumber?.startsWith("P-1")
  );
  let pumpOffset = 0;
  for (const pump of feedPumps) {
    const id = pump.id || pump.tagNumber || "";
    positions.set(id, {
      asset: pump,
      position: [xPos - 2, -0.5, zBase + 2 + pumpOffset],
      parentUnit: "feed"
    });
    pumpOffset += 1.5;
  }

  xPos += 4;

  // === REACTION SECTION ===
  for (let i = 0; i < reactors.length; i++) {
    const reactor = reactors[i];
    const id = reactor.id || reactor.tagNumber || "";
    const reactorX = xPos + i * 6;
    const reactorZ = zBase;

    positions.set(id, {
      asset: reactor,
      position: [reactorX, 0.5, reactorZ],
      parentUnit: "reaction"
    });

    // Find associated heat exchangers (feed preheater, effluent cooler)
    const reactorExchangers = exchangers.filter(e => {
      const tag = e.tagNumber || "";
      const name = e.name?.toLowerCase() || "";
      // Match by tag number pattern or name
      return tag.includes(reactor.tagNumber?.replace("R-", "E-") || "XXX") ||
             name.includes("reactor") ||
             name.includes("feed") && name.includes("heat");
    });

    // Feed preheater upstream of reactor
    if (reactorExchangers.length > 0) {
      const preheater = reactorExchangers[0];
      const preheatId = preheater.id || preheater.tagNumber || "";
      positions.set(preheatId, {
        asset: preheater,
        position: [reactorX - 3, 0, reactorZ],
        parentUnit: "reaction"
      });

      // Pipe from preheater to reactor
      pipes.push({
        from: [reactorX - 2, 0, reactorZ],
        to: [reactorX - 1, 0.5, reactorZ],
        color: "#f97316"
      });
    }

    // Effluent cooler downstream of reactor
    if (reactorExchangers.length > 1) {
      const cooler = reactorExchangers[1];
      const coolerId = cooler.id || cooler.tagNumber || "";
      positions.set(coolerId, {
        asset: cooler,
        position: [reactorX + 3, 0, reactorZ],
        parentUnit: "reaction"
      });

      // Pipe from reactor to cooler
      pipes.push({
        from: [reactorX + 1, 0.5, reactorZ],
        to: [reactorX + 2, 0, reactorZ],
        color: "#ef4444"
      });
    }

    // Reactor circulation/transfer pump
    const reactorPumps = pumps.filter(p =>
      p.tagNumber?.includes(reactor.tagNumber?.replace("R-", "P-") || "XXX") ||
      p.name?.toLowerCase().includes("reactor")
    );
    for (let j = 0; j < reactorPumps.length; j++) {
      const pump = reactorPumps[j];
      const pumpId = pump.id || pump.tagNumber || "";
      positions.set(pumpId, {
        asset: pump,
        position: [reactorX, -0.5, reactorZ + 2 + j * 1.5],
        parentUnit: "reaction"
      });
    }
  }

  xPos += reactors.length * 6 + 4;

  // === SEPARATION SECTION (columns with their auxiliaries) ===
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    const id = column.id || column.tagNumber || "";
    const colX = xPos + i * 8;
    const colZ = zBase;

    // Column is tall, centered
    positions.set(id, {
      asset: column,
      position: [colX, 1.5, colZ],
      parentUnit: "separation"
    });

    // Condenser - at top of column, offset
    const condensers = exchangers.filter(e =>
      e.name?.toLowerCase().includes("condenser") ||
      e.tagNumber?.includes(column.tagNumber?.replace("C-", "E-") || "XXX")
    );
    if (condensers.length > 0) {
      const condenser = condensers[0];
      const condId = condenser.id || condenser.tagNumber || "";
      positions.set(condId, {
        asset: condenser,
        position: [colX + 2, 2.5, colZ],
        parentUnit: "separation"
      });

      // Overhead vapor line to condenser
      pipes.push({
        from: [colX + 0.5, 2.8, colZ],
        to: [colX + 1.5, 2.5, colZ],
        color: "#94a3b8"
      });
    }

    // Reflux drum - below condenser
    const refluxDrums = vessels.filter(v =>
      v.name?.toLowerCase().includes("reflux") ||
      v.tagNumber?.includes(column.tagNumber?.replace("C-", "V-") || "XXX")
    );
    if (refluxDrums.length > 0) {
      const drum = refluxDrums[0];
      const drumId = drum.id || drum.tagNumber || "";
      positions.set(drumId, {
        asset: drum,
        position: [colX + 2, 1, colZ],
        parentUnit: "separation"
      });

      // Condensate to reflux drum
      pipes.push({
        from: [colX + 2, 2, colZ],
        to: [colX + 2, 1.4, colZ],
        color: "#3b82f6"
      });
    }

    // Reboiler - at bottom of column
    const reboilers = exchangers.filter(e =>
      e.name?.toLowerCase().includes("reboiler")
    );
    if (reboilers.length > i) {
      const reboiler = reboilers[i];
      const rebId = reboiler.id || reboiler.tagNumber || "";
      positions.set(rebId, {
        asset: reboiler,
        position: [colX - 2, -0.5, colZ],
        parentUnit: "separation"
      });

      // Bottoms to reboiler circulation
      pipes.push({
        from: [colX - 0.5, 0, colZ],
        to: [colX - 1.5, -0.5, colZ],
        color: "#f97316"
      });
    } else {
      // GAP: Column has no reboiler documented
      gaps.push({
        id: `gap-reboiler-${column.tagNumber}`,
        type: "reboiler",
        label: "Reboiler?",
        description: `Column ${column.tagNumber} needs a reboiler - not documented in inventory`,
        position: [colX - 2, -0.5, colZ],
        severity: "critical"
      });
    }

    // Check for missing reflux drum
    if (refluxDrums.length === 0 && condensers.length > 0) {
      gaps.push({
        id: `gap-reflux-${column.tagNumber}`,
        type: "reflux_drum",
        label: "Reflux Drum?",
        description: `Column ${column.tagNumber} has condenser but no reflux drum documented`,
        position: [colX + 2, 1, colZ],
        severity: "major"
      });
    }

    // Reflux pump
    const refluxPumps = pumps.filter(p =>
      p.name?.toLowerCase().includes("reflux")
    );
    if (refluxPumps.length > i) {
      const pump = refluxPumps[i];
      const pumpId = pump.id || pump.tagNumber || "";
      positions.set(pumpId, {
        asset: pump,
        position: [colX + 2, 0, colZ + 1.5],
        parentUnit: "separation"
      });
    }

    // Bottoms pump
    const bottomsPumps = pumps.filter(p =>
      p.name?.toLowerCase().includes("bottom") ||
      p.tagNumber?.startsWith("P-4")
    );
    if (bottomsPumps.length > i) {
      const pump = bottomsPumps[i];
      const pumpId = pump.id || pump.tagNumber || "";
      positions.set(pumpId, {
        asset: pump,
        position: [colX - 2, -0.5, colZ + 1.5],
        parentUnit: "separation"
      });
    }
  }

  xPos += columns.length * 8 + 4;

  // === PRODUCT STORAGE (right side) ===
  const productTanks = vessels.filter(a =>
    a.name?.toLowerCase().includes("product") ||
    a.name?.toLowerCase().includes("storage") ||
    a.engineering?.processArea?.toLowerCase().includes("storage") ||
    a.tagNumber?.startsWith("TK-3") ||
    a.tagNumber?.startsWith("TK-4")
  );

  for (let i = 0; i < productTanks.length; i++) {
    const tank = productTanks[i];
    const id = tank.id || tank.tagNumber || "";
    positions.set(id, {
      asset: tank,
      position: [xPos + i * 4, 0, zBase + (i % 2) * 3],
      parentUnit: "storage"
    });
  }

  // Transfer pumps near storage
  const transferPumps = pumps.filter(p =>
    p.name?.toLowerCase().includes("transfer") ||
    p.tagNumber?.startsWith("P-5")
  );
  for (let i = 0; i < transferPumps.length; i++) {
    const pump = transferPumps[i];
    const id = pump.id || pump.tagNumber || "";
    positions.set(id, {
      asset: pump,
      position: [xPos + i * 3, -0.5, zBase + 4],
      parentUnit: "storage"
    });
  }

  // === UTILITIES (offset to the back) ===
  const utilityAssets = assets.filter(a =>
    a.engineering?.processArea?.toLowerCase().includes("utilit") ||
    a.name?.toLowerCase().includes("cooling water") ||
    a.name?.toLowerCase().includes("steam") ||
    a.name?.toLowerCase().includes("nitrogen") ||
    a.name?.toLowerCase().includes("air")
  );

  let utilX = -10;
  const utilZ = -8;
  for (const util of utilityAssets) {
    const id = util.id || util.tagNumber || "";
    if (!positions.has(id)) {
      positions.set(id, {
        asset: util,
        position: [utilX, 0, utilZ],
        parentUnit: "utilities"
      });
      utilX += 3;
    }
  }

  // === CONTROLLERS (control room area) ===
  const controllers = assets.filter(a =>
    a.assetType === "plc" ||
    a.assetType === "dcs_controller" ||
    a.assetType === "safety_controller" ||
    a.layer === 3
  );

  const controlRoomX = 0;
  const controlRoomZ = -12;
  for (let i = 0; i < controllers.length; i++) {
    const ctrl = controllers[i];
    const id = ctrl.id || ctrl.tagNumber || "";
    if (!positions.has(id)) {
      positions.set(id, {
        asset: ctrl,
        position: [controlRoomX + (i % 5) * 2, 0.3, controlRoomZ - Math.floor(i / 5) * 2],
        parentUnit: "control"
      });
    }
  }

  // === INSTRUMENTS - position near their parent equipment ===
  const instruments = assets.filter(a =>
    a.layer === 2 ||
    a.assetType?.includes("sensor") ||
    a.assetType?.includes("valve") ||
    a.assetType?.includes("transmitter")
  );

  for (const inst of instruments) {
    const id = inst.id || inst.tagNumber || "";
    if (positions.has(id)) continue;

    // Try to find parent equipment from tag number
    // TIC-101 controls reactor R-101, so look for matching numbers
    const tagNum = inst.tagNumber || "";
    const numMatch = tagNum.match(/(\d{3})/);

    if (numMatch) {
      const num = numMatch[1];
      // Find equipment with matching number
      for (const [eqId, eqPos] of positions) {
        if (eqId.includes(num) || eqPos.asset.tagNumber?.includes(num)) {
          // Position instrument near this equipment
          const offset = Math.random() * 0.8 - 0.4;
          const yOffset = inst.assetType?.includes("valve") ? -0.3 : 0.8;
          positions.set(id, {
            asset: inst,
            position: [
              eqPos.position[0] + offset,
              eqPos.position[1] + yOffset,
              eqPos.position[2] + 0.8 + Math.random() * 0.5
            ],
            parentUnit: eqPos.parentUnit
          });
          break;
        }
      }
    }

    // If still not placed, put in a general instrument area
    if (!positions.has(id)) {
      positions.set(id, {
        asset: inst,
        position: [
          Math.random() * 20 - 10,
          0.5,
          5 + Math.random() * 3
        ],
        parentUnit: "instruments"
      });
    }
  }

  // === Remaining unplaced equipment ===
  let unplacedX = -15;
  for (const asset of assets) {
    const id = asset.id || asset.tagNumber || "";
    if (!positions.has(id) && asset.layer && asset.layer <= 3) {
      positions.set(id, {
        asset: asset,
        position: [unplacedX, 0, 8],
        parentUnit: "other"
      });
      unplacedX += 2;
    }
  }

  // === DETECT MAJOR PROCESS GAPS ===

  // Check for feed preparation section
  const hasFeedPrep = assets.some(a =>
    a.engineering?.processArea?.toLowerCase().includes("feed prep") ||
    a.name?.toLowerCase().includes("feed heater") ||
    a.name?.toLowerCase().includes("feed filter")
  );
  if (!hasFeedPrep && reactors.length > 0) {
    gaps.push({
      id: "gap-feed-prep",
      type: "feed_prep",
      label: "Feed Prep?",
      description: "No feed preparation equipment documented - raw materials typically need filtering, heating, or mixing before reaction",
      position: [-8, 0.5, 0],
      severity: "major"
    });
  }

  // Check for catalyst system (for polymerization)
  const hasCatalyst = assets.some(a =>
    a.name?.toLowerCase().includes("catalyst") ||
    a.tagNumber?.includes("CAT")
  );
  const isPolymerization = assets.some(a =>
    a.name?.toLowerCase().includes("polymer") ||
    a.name?.toLowerCase().includes("monomer")
  );
  if (!hasCatalyst && isPolymerization) {
    gaps.push({
      id: "gap-catalyst",
      type: "catalyst",
      label: "Catalyst System?",
      description: "Polymerization process detected but no catalyst feed system documented",
      position: [-4, 0.5, 3],
      severity: "critical"
    });
  }

  // Check for product finishing/pelletizing
  const hasFinishing = assets.some(a =>
    a.name?.toLowerCase().includes("pellet") ||
    a.name?.toLowerCase().includes("extrud") ||
    a.name?.toLowerCase().includes("dryer") ||
    a.name?.toLowerCase().includes("bagging")
  );
  if (!hasFinishing && isPolymerization) {
    gaps.push({
      id: "gap-finishing",
      type: "finishing",
      label: "Finishing?",
      description: "Polymer product but no finishing equipment (pelletizer, dryer, bagging) documented",
      position: [xPos + 8, 0.5, 0],
      severity: "major"
    });
  }

  // Check that each pump-requiring equipment has pumps
  for (const column of columns) {
    const hasRefluxPump = pumps.some(p =>
      p.name?.toLowerCase().includes("reflux") ||
      p.tagNumber?.includes(column.tagNumber?.replace("C-", "P-") || "XXX")
    );
    if (!hasRefluxPump) {
      const colPos = positions.get(column.id || column.tagNumber || "");
      if (colPos) {
        gaps.push({
          id: `gap-pump-reflux-${column.tagNumber}`,
          type: "pump",
          label: "Reflux Pump?",
          description: `Column ${column.tagNumber} needs reflux pump - not documented`,
          position: [colPos.position[0] + 2, -0.5, colPos.position[2] + 1.5],
          severity: "major"
        });
      }
    }
  }

  // Build units summary
  const units: ProcessUnit[] = [
    { id: "feed", name: "Feed Section", assets: [], position: [-12, 0, 0], connections: ["reaction"] },
    { id: "reaction", name: "Reaction", assets: [], position: [-2, 0, 0], connections: ["separation"] },
    { id: "separation", name: "Separation", assets: [], position: [10, 0, 0], connections: ["storage"] },
    { id: "storage", name: "Product Storage", assets: [], position: [25, 0, 0], connections: [] },
    { id: "utilities", name: "Utilities", assets: [], position: [-10, 0, -8], connections: [] },
    { id: "control", name: "Control Room", assets: [], position: [0, 0, -12], connections: [] },
  ];

  return { positions, pipes, units, gaps };
}

// ============================================================================
// 3D EQUIPMENT COMPONENTS
// ============================================================================

const LAYER_COLORS: Record<number, string> = {
  1: "#3b82f6",
  2: "#22c55e",
  3: "#f59e0b",
};

const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const UNIT_COLORS: Record<string, string> = {
  feed: "#22c55e",
  reaction: "#ef4444",
  separation: "#3b82f6",
  storage: "#8b5cf6",
  utilities: "#6b7280",
  control: "#f59e0b",
  instruments: "#14b8a6",
  other: "#6b7280",
};

function getColor(
  asset: Partial<CanonAsset>,
  colorMode: "layer" | "risk" | "unit",
  parentUnit?: string
): string {
  if (colorMode === "unit") {
    return UNIT_COLORS[parentUnit || "other"] || "#6b7280";
  }
  if (colorMode === "layer") {
    return LAYER_COLORS[asset.layer || 1] || "#6b7280";
  }
  if (colorMode === "risk") {
    return RISK_COLORS[asset.security?.riskTier || "low"] || "#22c55e";
  }
  return "#6b7280";
}

// Column - tall cylinder
function Column3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.6, 4, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Trays indication */}
      {[0, 0.8, 1.6].map((y, i) => (
        <mesh key={i} position={[0, y - 1, 0]}>
          <torusGeometry args={[0.55, 0.03, 8, 16]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      ))}
    </group>
  );
}

// Reactor - vessel with agitator indication
function Reactor3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle pulsing for reactors (they're doing chemistry!)
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.01);
    }
  });

  return (
    <group ref={meshRef} position={position} onClick={onClick}>
      <mesh>
        <cylinderGeometry args={[0.7, 0.7, 2, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>
      {/* Top dome */}
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Bottom dish */}
      <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Agitator motor on top */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.4, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
}

// Vessel/Tank - horizontal drum
function Vessel3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.5, 0.5, 1.5, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      {/* End caps */}
      <mesh position={[0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[-0.85, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.4, -0.6, 0]}>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[0.4, -0.6, 0]}>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  );
}

// Heat Exchanger - shell & tube
function Exchanger3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, 2, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>
      {/* Channel heads */}
      <mesh position={[1.1, 0, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-1.1, 0, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Nozzles */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
        <meshStandardMaterial color="#666" />
      </mesh>
    </group>
  );
}

// Pump
function Pump3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      {/* Pump casing */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.25, 0.3, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      {/* Motor */}
      <mesh position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.4, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Suction */}
      <mesh position={[0, 0, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.15, 8]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      {/* Discharge */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.15, 8]} />
        <meshStandardMaterial color="#666" />
      </mesh>
    </group>
  );
}

// Controller/PLC
function Controller3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <boxGeometry args={[0.4, 0.6, 0.15]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>
      {/* Status lights */}
      <mesh position={[0.12, 0.2, 0.08]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.2, 0.08]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.12, 0.2, 0.08]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.1} />
      </mesh>
    </group>
  );
}

// Sensor/Transmitter
function Sensor3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <boxGeometry args={[0.1, 0.12, 0.08]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>
      {/* Process connection */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
        <meshStandardMaterial color="#666" />
      </mesh>
    </group>
  );
}

// Valve
function Valve3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position} onClick={onClick}>
      {/* Valve body */}
      <mesh>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>
      {/* Actuator/handwheel */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.12, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.06, 0.015, 8, 16]} />
        <meshStandardMaterial color="#666" />
      </mesh>
    </group>
  );
}

// Generic fallback
function Generic3D({ position, color, selected, onClick }: {
  position: [number, number, number];
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial
        color={color}
        emissive={selected ? color : "#000000"}
        emissiveIntensity={selected ? 0.4 : 0}
      />
    </mesh>
  );
}

// ============================================================================
// GHOST EQUIPMENT - Visual indicator for gaps/missing equipment
// ============================================================================

function GhostEquipment({ gap, selected, onSelect }: {
  gap: GapPosition;
  selected: boolean;
  onSelect: (gap: GapPosition) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Pulsing animation to draw attention
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
    }
  });

  const color = gap.severity === "critical" ? "#ef4444" : gap.severity === "major" ? "#f97316" : "#eab308";

  // Different shapes based on gap type
  const getShape = () => {
    switch (gap.type) {
      case "reboiler":
        return (
          <group>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.25, 0.25, 1.5, 16]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={0.4}
                wireframe
              />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.27, 0.27, 1.5, 16]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={0.15}
              />
            </mesh>
          </group>
        );
      case "reflux_drum":
        return (
          <group>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.35, 0.35, 1, 16]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={0.4}
                wireframe
              />
            </mesh>
          </group>
        );
      case "pump":
        return (
          <group>
            <mesh>
              <cylinderGeometry args={[0.15, 0.2, 0.25, 8]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={0.4}
                wireframe
              />
            </mesh>
          </group>
        );
      case "feed_prep":
      case "finishing":
      case "catalyst":
      default:
        return (
          <group>
            <mesh ref={meshRef}>
              <boxGeometry args={[1.5, 1, 1]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={0.3}
                wireframe
              />
            </mesh>
            <mesh>
              <boxGeometry args={[1.6, 1.1, 1.1]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={0.1}
              />
            </mesh>
          </group>
        );
    }
  };

  return (
    <group position={gap.position} onClick={() => onSelect(gap)}>
      {getShape()}
      {/* Question mark indicator */}
      <Html position={[0, 1, 0]} center style={{ pointerEvents: "none" }}>
        <div className={`px-2 py-1 rounded text-xs font-bold text-white ${
          gap.severity === "critical" ? "bg-red-500" :
          gap.severity === "major" ? "bg-orange-500" : "bg-yellow-500"
        } animate-pulse`}>
          {gap.label}
        </div>
      </Html>
    </group>
  );
}

// Equipment renderer
function Equipment({
  asset,
  position,
  selected,
  onSelect,
  colorMode,
  parentUnit,
}: {
  asset: Partial<CanonAsset>;
  position: [number, number, number];
  selected: boolean;
  onSelect: (asset: Partial<CanonAsset>) => void;
  colorMode: "layer" | "risk" | "unit";
  parentUnit?: string;
}) {
  const color = getColor(asset, colorMode, parentUnit);
  const onClick = () => onSelect(asset);
  const type = asset.assetType || "";
  const name = asset.name?.toLowerCase() || "";

  if (type === "column") {
    return <Column3D position={position} color={color} selected={selected} onClick={onClick} />;
  }
  if (type === "reactor") {
    return <Reactor3D position={position} color={color} selected={selected} onClick={onClick} />;
  }
  if (type === "vessel" || type === "tank" || name.includes("drum") || name.includes("tank")) {
    return <Vessel3D position={position} color={color} selected={selected} onClick={onClick} />;
  }
  if (type === "heat_exchanger" || name.includes("exchanger") || name.includes("cooler") || name.includes("heater") || name.includes("condenser") || name.includes("reboiler")) {
    return <Exchanger3D position={position} color={color} selected={selected} onClick={onClick} />;
  }
  if (type === "pump") {
    return <Pump3D position={position} color={color} selected={selected} onClick={onClick} />;
  }
  if (type.includes("controller") || type === "plc" || type === "dcs_controller" || type === "safety_controller") {
    return <Controller3D position={position} color={color} selected={selected} onClick={onClick} />;
  }
  if (type.includes("sensor") || type.includes("transmitter")) {
    return <Sensor3D position={position} color={color} selected={selected} onClick={onClick} />;
  }
  if (type.includes("valve")) {
    return <Valve3D position={position} color={color} selected={selected} onClick={onClick} />;
  }

  return <Generic3D position={position} color={color} selected={selected} onClick={onClick} />;
}

// Pipe
function Pipe3D({ start, end, color = "#888888" }: {
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
}) {
  const points = useMemo(() => [
    new THREE.Vector3(...start),
    new THREE.Vector3(...end),
  ], [start, end]);

  return <Line points={points} color={color} lineWidth={3} />;
}

// Unit label
function UnitLabel({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Text
      position={position}
      fontSize={0.6}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.05}
      outlineColor="#000000"
    >
      {text}
    </Text>
  );
}

// Scene
function PlantScene({
  assets,
  selectedAsset,
  onSelectAsset,
  selectedGap,
  onSelectGap,
  colorMode,
  showGaps,
}: {
  assets: Partial<CanonAsset>[];
  selectedAsset: Partial<CanonAsset> | null;
  onSelectAsset: (asset: Partial<CanonAsset> | null) => void;
  selectedGap: GapPosition | null;
  onSelectGap: (gap: GapPosition | null) => void;
  colorMode: "layer" | "risk" | "unit";
  showGaps: boolean;
}) {
  const { positions, pipes, units, gaps } = useMemo(() => buildProcessFlow(assets), [assets]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 10]} intensity={0.8} />
      <directionalLight position={[-10, 20, -10]} intensity={0.3} />
      <pointLight position={[0, 10, 0]} intensity={0.2} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <gridHelper args={[80, 40, "#334155", "#1e293b"]} position={[0, -0.99, 0]} />

      {/* Unit labels */}
      {units.map(unit => (
        <UnitLabel
          key={unit.id}
          position={[unit.position[0], 5, unit.position[2]]}
          text={unit.name}
        />
      ))}

      {/* Equipment */}
      {Array.from(positions.entries()).map(([id, eqPos]) => (
        <group key={id}>
          <Equipment
            asset={eqPos.asset}
            position={eqPos.position}
            selected={
              selectedAsset?.id === eqPos.asset.id ||
              selectedAsset?.tagNumber === eqPos.asset.tagNumber
            }
            onSelect={onSelectAsset}
            colorMode={colorMode}
            parentUnit={eqPos.parentUnit}
          />
          {/* Tag label on hover/select */}
          <Html
            position={[eqPos.position[0], eqPos.position[1] + 1.2, eqPos.position[2]]}
            center
            style={{ pointerEvents: "none" }}
          >
            <div className="text-[10px] text-white bg-black/70 px-1 py-0.5 rounded whitespace-nowrap">
              {eqPos.asset.tagNumber}
            </div>
          </Html>
        </group>
      ))}

      {/* Pipes */}
      {pipes.map((pipe, idx) => (
        <Pipe3D key={idx} start={pipe.from} end={pipe.to} color={pipe.color} />
      ))}

      {/* Equipment Gaps - ghost equipment showing what's missing */}
      {showGaps && gaps.map((gap) => (
        <GhostEquipment
          key={gap.id}
          gap={gap}
          selected={selectedGap?.id === gap.id}
          onSelect={(g) => {
            onSelectGap(g);
            onSelectAsset(null);
          }}
        />
      ))}

      {/* Gap count indicator */}
      {showGaps && gaps.length > 0 && (
        <Html position={[-15, 6, 0]} center>
          <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            {gaps.length} Equipment Gaps
          </div>
        </Html>
      )}

      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.05}
        target={[5, 0, 0]}
      />
    </>
  );
}

// Main component
export default function Plant3DView({ assets }: { assets: Partial<CanonAsset>[] }) {
  const [selectedAsset, setSelectedAsset] = useState<Partial<CanonAsset> | null>(null);
  const [selectedGap, setSelectedGap] = useState<GapPosition | null>(null);
  const [colorMode, setColorMode] = useState<"layer" | "risk" | "unit">("unit");
  const [showGaps, setShowGaps] = useState(true); // Show gaps by default

  // Count gaps for display
  const { gaps } = useMemo(() => buildProcessFlow(assets), [assets]);

  return (
    <div className="relative w-full h-[700px] bg-slate-900 rounded-lg overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 items-center">
        <select
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value as "layer" | "risk" | "unit")}
          className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded border border-slate-700"
        >
          <option value="unit">Color by Process Unit</option>
          <option value="layer">Color by Purdue Layer</option>
          <option value="risk">Color by Risk Tier</option>
        </select>

        <button
          onClick={() => setShowGaps(!showGaps)}
          className={`px-3 py-1.5 rounded text-sm font-medium border ${
            showGaps
              ? "bg-red-600 border-red-500 text-white"
              : "bg-slate-800 border-slate-700 text-slate-400"
          }`}
        >
          {showGaps ? `Gaps (${gaps.length})` : "Show Gaps"}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-slate-800/95 p-3 rounded text-xs border border-slate-700">
        <div className="text-slate-400 mb-2 font-medium">
          {colorMode === "unit" ? "Process Units" : colorMode === "layer" ? "Purdue Layers" : "Risk Tiers"}
        </div>
        {colorMode === "unit" && (
          <div className="space-y-1">
            {Object.entries(UNIT_COLORS).slice(0, 6).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-white capitalize">{name}</span>
              </div>
            ))}
          </div>
        )}
        {colorMode === "layer" && (
          <div className="space-y-1">
            {Object.entries(LAYER_COLORS).map(([layer, color]) => (
              <div key={layer} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-white">L{layer}: {layer === "1" ? "Physical" : layer === "2" ? "Instrumentation" : "Control"}</span>
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
      <div className="absolute bottom-4 left-4 z-10 text-slate-400 text-xs bg-slate-800/80 px-2 py-1 rounded">
        Drag to orbit | Scroll to zoom | Click equipment for details
      </div>

      {/* Selected asset panel */}
      {selectedAsset && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-800/95 p-4 rounded-lg w-80 border border-slate-700">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-mono font-bold text-white text-lg">{selectedAsset.tagNumber}</div>
              <div className="text-sm text-slate-400">{selectedAsset.name}</div>
            </div>
            <button
              onClick={() => setSelectedAsset(null)}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="text-white">{selectedAsset.assetType?.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Layer</span>
              <span className="text-white">L{selectedAsset.layer}</span>
            </div>
            {selectedAsset.engineering?.processArea && (
              <div className="flex justify-between">
                <span className="text-slate-500">Process Area</span>
                <span className="text-white">{selectedAsset.engineering.processArea}</span>
              </div>
            )}
            {selectedAsset.security?.riskTier && (
              <div className="flex justify-between">
                <span className="text-slate-500">Risk</span>
                <span className={`capitalize font-medium ${
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
                <span className="text-slate-500">IP</span>
                <span className="text-white font-mono text-xs">{selectedAsset.network.ipAddress}</span>
              </div>
            )}
            {selectedAsset.description && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-slate-400 text-xs">{selectedAsset.description}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected gap panel */}
      {selectedGap && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-800/95 p-4 rounded-lg w-80 border-2 border-red-500">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-bold text-red-400 text-lg flex items-center gap-2">
                <span className="text-2xl">⚠</span>
                Equipment Gap
              </div>
              <div className="text-sm text-white">{selectedGap.label}</div>
            </div>
            <button
              onClick={() => setSelectedGap(null)}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Severity</span>
              <span className={`capitalize font-medium ${
                selectedGap.severity === "critical" ? "text-red-400" :
                selectedGap.severity === "major" ? "text-orange-400" :
                "text-yellow-400"
              }`}>
                {selectedGap.severity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="text-white capitalize">{selectedGap.type.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-slate-300 text-xs leading-relaxed">{selectedGap.description}</div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 bg-slate-900/50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
              <div className="text-slate-400 text-xs font-medium mb-1">Action Required:</div>
              <div className="text-white text-xs">Document this equipment in the inventory to complete the plant model.</div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <Canvas camera={{ position: [25, 20, 25], fov: 45 }} shadows>
        <Suspense fallback={null}>
          <PlantScene
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={(asset) => {
              setSelectedAsset(asset);
              setSelectedGap(null);
            }}
            selectedGap={selectedGap}
            onSelectGap={(gap) => {
              setSelectedGap(gap);
              setSelectedAsset(null);
            }}
            colorMode={colorMode}
            showGaps={showGaps}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
