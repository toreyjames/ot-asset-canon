// Relationship Inference Engine
// Automatically detects relationships between assets based on:
// - Tag number patterns (ISA standard)
// - Process area grouping
// - Network topology
// - Layer adjacency
// - Control loop completion

import type { CanonAsset, AssetType, RelationshipType, CanonLayer } from "@/types/canon";

// ISA Tag Pattern Analysis
// First letter(s) = Measured Variable
// T = Temperature, P = Pressure, F = Flow, L = Level, A = Analytical
// Second letter = Function
// T = Transmitter, I = Indicator, C = Controller, V = Valve, S = Switch, E = Element

interface TagComponents {
  variable: string;      // T, P, F, L, A, etc.
  functions: string[];   // I, C, T, V, S, A, E, etc.
  loopNumber: string;    // 101, 102, etc.
  suffix?: string;       // A, B, etc. for redundant instruments
  raw: string;
}

// Parse ISA-style tag numbers
function parseTagNumber(tag: string): TagComponents | null {
  if (!tag) return null;

  // Common patterns:
  // TIC-101, TT-101A, PIC-201, FV-101, LIC-301
  // Also handle: TI101, PT101, FIC_201

  const normalized = tag.toUpperCase().replace(/[_\s]/g, "-");

  // Pattern: [Variable][Functions]-[Number][Suffix]
  const match = normalized.match(/^([A-Z])([A-Z]*)[-]?(\d+)([A-Z]?)$/);

  if (match) {
    return {
      variable: match[1],
      functions: match[2].split(""),
      loopNumber: match[3],
      suffix: match[4] || undefined,
      raw: tag,
    };
  }

  // Try simpler pattern for equipment tags: R-101, P-101, V-101
  const equipMatch = normalized.match(/^([A-Z]+)[-]?(\d+)([A-Z]?)$/);
  if (equipMatch) {
    return {
      variable: equipMatch[1],
      functions: [],
      loopNumber: equipMatch[2],
      suffix: equipMatch[3] || undefined,
      raw: tag,
    };
  }

  return null;
}

// Variable type descriptions
const VARIABLE_TYPES: Record<string, string> = {
  T: "Temperature",
  P: "Pressure",
  F: "Flow",
  L: "Level",
  A: "Analytical",
  S: "Speed",
  W: "Weight",
  D: "Density",
  M: "Moisture",
  V: "Vibration",
  Z: "Position",
  H: "Hand (manual)",
  X: "Unclassified",
  Y: "Event/State",
};

// Function type descriptions
const FUNCTION_TYPES: Record<string, { name: string; role: "sensor" | "controller" | "actuator" | "indicator" | "other" }> = {
  E: { name: "Element", role: "sensor" },
  T: { name: "Transmitter", role: "sensor" },
  I: { name: "Indicator", role: "indicator" },
  C: { name: "Controller", role: "controller" },
  V: { name: "Valve", role: "actuator" },
  S: { name: "Switch", role: "sensor" },
  A: { name: "Alarm", role: "indicator" },
  R: { name: "Recorder", role: "indicator" },
  Y: { name: "Relay/Compute", role: "controller" },
  Z: { name: "Driver/Actuator", role: "actuator" },
  H: { name: "Hand (manual)", role: "other" },
  L: { name: "Light", role: "indicator" },
  G: { name: "Glass/Gauge", role: "indicator" },
};

// Inferred relationship
export interface InferredRelationship {
  sourceId: string;
  sourceTag: string;
  targetId: string;
  targetTag: string;
  relationshipType: RelationshipType;
  confidence: number; // 0-100
  inferenceMethod: string;
  description: string;
}

// Control loop structure
export interface ControlLoop {
  id: string;
  loopNumber: string;
  variable: string;
  variableName: string;
  processArea?: string;

  sensor?: {
    id: string;
    tag: string;
    type: string;
  };
  controller?: {
    id: string;
    tag: string;
    type: string;
  };
  actuator?: {
    id: string;
    tag: string;
    type: string;
  };

  status: "complete" | "partial" | "orphaned";
  missingElements: string[];
  networkConnected: boolean;
}

// Network path
export interface NetworkPath {
  fromAsset: { id: string; tag: string; ip: string };
  toAsset: { id: string; tag: string; ip: string };
  hops: { id: string; tag: string; ip: string; type: string }[];
  sameVlan: boolean;
  crossesFirewall: boolean;
}

// Main inference engine
export class RelationshipInferenceEngine {
  private assets: Map<string, Partial<CanonAsset>> = new Map();
  private tagIndex: Map<string, Partial<CanonAsset>> = new Map();
  private loopIndex: Map<string, Partial<CanonAsset>[]> = new Map();
  private processAreaIndex: Map<string, Partial<CanonAsset>[]> = new Map();
  private ipIndex: Map<string, Partial<CanonAsset>> = new Map();
  private vlanIndex: Map<number, Partial<CanonAsset>[]> = new Map();

  constructor(assets: Partial<CanonAsset>[]) {
    this.indexAssets(assets);
  }

  private indexAssets(assets: Partial<CanonAsset>[]) {
    for (const asset of assets) {
      if (!asset.id) continue;

      this.assets.set(asset.id, asset);

      // Index by tag
      if (asset.tagNumber) {
        this.tagIndex.set(asset.tagNumber.toUpperCase(), asset);

        // Index by loop number
        const parsed = parseTagNumber(asset.tagNumber);
        if (parsed) {
          const loopKey = `${parsed.variable}-${parsed.loopNumber}`;
          if (!this.loopIndex.has(loopKey)) {
            this.loopIndex.set(loopKey, []);
          }
          this.loopIndex.get(loopKey)!.push(asset);
        }
      }

      // Index by process area
      if (asset.engineering?.processArea) {
        const area = asset.engineering.processArea;
        if (!this.processAreaIndex.has(area)) {
          this.processAreaIndex.set(area, []);
        }
        this.processAreaIndex.get(area)!.push(asset);
      }

      // Index by IP address
      if (asset.network?.ipAddress) {
        this.ipIndex.set(asset.network.ipAddress, asset);
      }

      // Index by VLAN
      if (asset.network?.vlan) {
        const vlan = asset.network.vlan;
        if (!this.vlanIndex.has(vlan)) {
          this.vlanIndex.set(vlan, []);
        }
        this.vlanIndex.get(vlan)!.push(asset);
      }
    }
  }

  // Infer all control loops
  inferControlLoops(): ControlLoop[] {
    const loops: ControlLoop[] = [];
    const processedLoops = new Set<string>();

    for (const [loopKey, assets] of this.loopIndex) {
      if (processedLoops.has(loopKey)) continue;
      processedLoops.add(loopKey);

      const [variable, loopNumber] = loopKey.split("-");

      // Categorize assets in this loop by role
      let sensor: Partial<CanonAsset> | undefined;
      let controller: Partial<CanonAsset> | undefined;
      let actuator: Partial<CanonAsset> | undefined;

      for (const asset of assets) {
        const parsed = parseTagNumber(asset.tagNumber || "");
        if (!parsed) continue;

        // Check functions to determine role
        const functions = parsed.functions.join("");

        if (functions.includes("T") || functions.includes("E") || functions.includes("S")) {
          // Transmitter, Element, or Switch = Sensor
          if (!sensor) sensor = asset;
        }
        if (functions.includes("C") || functions.includes("Y")) {
          // Controller or Compute = Controller
          if (!controller) controller = asset;
        }
        if (functions.includes("V") || functions.includes("Z")) {
          // Valve or Driver = Actuator
          if (!actuator) actuator = asset;
        }
      }

      // Also check asset types for categorization
      for (const asset of assets) {
        const type = asset.assetType as string;
        if (!sensor && (type?.includes("sensor") || type?.includes("transmitter"))) {
          sensor = asset;
        }
        if (!controller && (type?.includes("controller") || type === "plc" || type === "dcs_controller")) {
          controller = asset;
        }
        if (!actuator && (type?.includes("valve") || type?.includes("motor") || type?.includes("drive"))) {
          actuator = asset;
        }
      }

      // Determine loop status
      const missingElements: string[] = [];
      if (!sensor) missingElements.push("sensor");
      if (!controller) missingElements.push("controller");
      if (!actuator) missingElements.push("actuator");

      const status: ControlLoop["status"] =
        missingElements.length === 0 ? "complete" :
        missingElements.length < 3 ? "partial" : "orphaned";

      // Check network connectivity
      const networkConnected = !!(
        (sensor?.network?.ipAddress) ||
        (controller?.network?.ipAddress) ||
        (actuator?.network?.ipAddress)
      );

      // Get process area from any member
      const processArea = sensor?.engineering?.processArea ||
        controller?.engineering?.processArea ||
        actuator?.engineering?.processArea;

      loops.push({
        id: loopKey,
        loopNumber,
        variable,
        variableName: VARIABLE_TYPES[variable] || "Unknown",
        processArea,
        sensor: sensor ? {
          id: sensor.id!,
          tag: sensor.tagNumber!,
          type: sensor.assetType as string,
        } : undefined,
        controller: controller ? {
          id: controller.id!,
          tag: controller.tagNumber!,
          type: controller.assetType as string,
        } : undefined,
        actuator: actuator ? {
          id: actuator.id!,
          tag: actuator.tagNumber!,
          type: actuator.assetType as string,
        } : undefined,
        status,
        missingElements,
        networkConnected,
      });
    }

    return loops;
  }

  // Infer relationships from control loops
  inferControlLoopRelationships(): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];
    const loops = this.inferControlLoops();

    for (const loop of loops) {
      // Sensor → Controller (monitors relationship)
      if (loop.sensor && loop.controller) {
        relationships.push({
          sourceId: loop.sensor.id,
          sourceTag: loop.sensor.tag,
          targetId: loop.controller.id,
          targetTag: loop.controller.tag,
          relationshipType: "monitors",
          confidence: 90,
          inferenceMethod: "tag_pattern",
          description: `${loop.sensor.tag} provides ${loop.variableName} measurement to ${loop.controller.tag}`,
        });
      }

      // Controller → Actuator (controls relationship)
      if (loop.controller && loop.actuator) {
        relationships.push({
          sourceId: loop.controller.id,
          sourceTag: loop.controller.tag,
          targetId: loop.actuator.id,
          targetTag: loop.actuator.tag,
          relationshipType: "controls",
          confidence: 90,
          inferenceMethod: "tag_pattern",
          description: `${loop.controller.tag} controls ${loop.actuator.tag} for ${loop.variableName} control`,
        });
      }

      // Sensor → Actuator (indirect - for loop completeness)
      if (loop.sensor && loop.actuator && !loop.controller) {
        relationships.push({
          sourceId: loop.sensor.id,
          sourceTag: loop.sensor.tag,
          targetId: loop.actuator.id,
          targetTag: loop.actuator.tag,
          relationshipType: "depends_on",
          confidence: 60,
          inferenceMethod: "tag_pattern_incomplete",
          description: `${loop.sensor.tag} and ${loop.actuator.tag} appear to be in same loop but controller is missing`,
        });
      }
    }

    return relationships;
  }

  // Infer network topology relationships
  inferNetworkRelationships(): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];

    // Get network devices (switches, routers, firewalls)
    const networkDevices = Array.from(this.assets.values()).filter(
      (a) => a.layer === 5 && a.network?.ipAddress
    );

    // Get all assets with IP addresses
    const networkedAssets = Array.from(this.assets.values()).filter(
      (a) => a.network?.ipAddress && a.layer !== 5
    );

    // For each VLAN, infer connections through switches
    for (const [vlan, assets] of this.vlanIndex) {
      // Find switch in this VLAN
      const switches = networkDevices.filter(
        (d) => d.assetType === "switch" && d.network?.vlan === vlan
      );

      if (switches.length > 0) {
        const primarySwitch = switches[0];

        // All assets in VLAN connect to switch
        for (const asset of assets) {
          if (asset.id !== primarySwitch.id && asset.layer !== 5) {
            relationships.push({
              sourceId: asset.id!,
              sourceTag: asset.tagNumber!,
              targetId: primarySwitch.id!,
              targetTag: primarySwitch.tagNumber!,
              relationshipType: "connects_to",
              confidence: 85,
              inferenceMethod: "vlan_membership",
              description: `${asset.tagNumber} connected to ${primarySwitch.tagNumber} on VLAN ${vlan}`,
            });
          }
        }
      }
    }

    // Infer firewall traversal
    const firewalls = networkDevices.filter((d) => d.assetType === "firewall");

    for (const firewall of firewalls) {
      // Assets in different VLANs likely traverse firewall
      const vlans = Array.from(this.vlanIndex.keys());

      if (vlans.length > 1) {
        // Firewall sits between VLANs
        for (const networkDevice of networkDevices) {
          if (networkDevice.id !== firewall.id && networkDevice.assetType === "switch") {
            relationships.push({
              sourceId: networkDevice.id!,
              sourceTag: networkDevice.tagNumber!,
              targetId: firewall.id!,
              targetTag: firewall.tagNumber!,
              relationshipType: "connects_to",
              confidence: 70,
              inferenceMethod: "network_topology",
              description: `${networkDevice.tagNumber} routes through ${firewall.tagNumber}`,
            });
          }
        }
      }
    }

    return relationships;
  }

  // Infer process hierarchy (equipment contains/uses instruments)
  inferProcessHierarchy(): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];

    // Get Layer 1 equipment
    const equipment = Array.from(this.assets.values()).filter((a) => a.layer === 1);

    // Get Layer 2 instruments
    const instruments = Array.from(this.assets.values()).filter((a) => a.layer === 2);

    for (const equip of equipment) {
      const equipTag = parseTagNumber(equip.tagNumber || "");
      if (!equipTag) continue;

      // Find instruments that reference this equipment
      // Pattern: Equipment R-101, Instruments on 101 (TIC-101, PIC-101, etc.)
      const relatedInstruments = instruments.filter((inst) => {
        const instTag = parseTagNumber(inst.tagNumber || "");
        if (!instTag) return false;

        // Same loop number
        if (instTag.loopNumber === equipTag.loopNumber) return true;

        // Same process area
        if (inst.engineering?.processArea === equip.engineering?.processArea) return true;

        return false;
      });

      for (const inst of relatedInstruments) {
        relationships.push({
          sourceId: inst.id!,
          sourceTag: inst.tagNumber!,
          targetId: equip.id!,
          targetTag: equip.tagNumber!,
          relationshipType: "monitors",
          confidence: 75,
          inferenceMethod: "process_hierarchy",
          description: `${inst.tagNumber} monitors ${equip.tagNumber}`,
        });
      }
    }

    return relationships;
  }

  // Infer HMI/Operator relationships
  inferOperatorRelationships(): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];

    // Get HMIs
    const hmis = Array.from(this.assets.values()).filter(
      (a) => a.assetType === "hmi"
    );

    // Get controllers
    const controllers = Array.from(this.assets.values()).filter(
      (a) => a.layer === 3
    );

    for (const hmi of hmis) {
      // Find controllers in same VLAN or process area
      for (const controller of controllers) {
        const sameVlan = hmi.network?.vlan === controller.network?.vlan;
        const sameArea = hmi.engineering?.processArea === controller.engineering?.processArea;

        if (sameVlan || sameArea) {
          relationships.push({
            sourceId: hmi.id!,
            sourceTag: hmi.tagNumber!,
            targetId: controller.id!,
            targetTag: controller.tagNumber!,
            relationshipType: "accesses",
            confidence: sameVlan && sameArea ? 90 : 70,
            inferenceMethod: sameVlan ? "network_proximity" : "process_area",
            description: `${hmi.tagNumber} provides operator access to ${controller.tagNumber}`,
          });
        }
      }
    }

    // Engineering workstations can modify controllers
    const workstations = Array.from(this.assets.values()).filter(
      (a) => a.assetType === "engineering_workstation"
    );

    for (const ws of workstations) {
      for (const controller of controllers) {
        const sameVlan = ws.network?.vlan === controller.network?.vlan;

        if (sameVlan) {
          relationships.push({
            sourceId: ws.id!,
            sourceTag: ws.tagNumber!,
            targetId: controller.id!,
            targetTag: controller.tagNumber!,
            relationshipType: "accesses",
            confidence: 85,
            inferenceMethod: "network_proximity",
            description: `${ws.tagNumber} has engineering access to ${controller.tagNumber}`,
          });
        }
      }
    }

    return relationships;
  }

  // Infer safety relationships (SIS)
  inferSafetyRelationships(): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];

    // Find safety-rated assets
    const safetyAssets = Array.from(this.assets.values()).filter(
      (a) =>
        a.engineering?.silRating ||
        a.assetType === "safety_plc" ||
        a.assetType === "safety_sensor" ||
        a.assetType === "safety_actuator" ||
        a.tagNumber?.includes("SIS") ||
        a.tagNumber?.includes("SIF")
    );

    // Find equipment they protect
    const equipment = Array.from(this.assets.values()).filter((a) => a.layer === 1);

    for (const safetyAsset of safetyAssets) {
      // Find equipment in same process area
      const protectedEquipment = equipment.filter(
        (e) => e.engineering?.processArea === safetyAsset.engineering?.processArea
      );

      for (const equip of protectedEquipment) {
        relationships.push({
          sourceId: safetyAsset.id!,
          sourceTag: safetyAsset.tagNumber!,
          targetId: equip.id!,
          targetTag: equip.tagNumber!,
          relationshipType: "protects",
          confidence: 80,
          inferenceMethod: "safety_function",
          description: `${safetyAsset.tagNumber} provides safety protection for ${equip.tagNumber}`,
        });
      }
    }

    return relationships;
  }

  // Infer remote access paths (attack surface)
  inferRemoteAccessPaths(): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];

    // Find remote access points
    const remoteAccess = Array.from(this.assets.values()).filter(
      (a) =>
        a.assetType === "vpn_concentrator" ||
        a.assetType === "remote_access" ||
        a.network?.remoteAccessExposure
    );

    // Find what they can reach
    const reachableAssets = Array.from(this.assets.values()).filter(
      (a) => a.network?.ipAddress && a.layer !== 6
    );

    for (const access of remoteAccess) {
      // VPN can reach engineering workstations
      const workstations = reachableAssets.filter(
        (a) => a.assetType === "engineering_workstation"
      );

      for (const ws of workstations) {
        relationships.push({
          sourceId: access.id!,
          sourceTag: access.tagNumber!,
          targetId: ws.id!,
          targetTag: ws.tagNumber!,
          relationshipType: "accesses",
          confidence: 75,
          inferenceMethod: "remote_access_path",
          description: `${access.tagNumber} provides remote path to ${ws.tagNumber}`,
        });
      }
    }

    return relationships;
  }

  // Get all inferred relationships
  inferAllRelationships(): InferredRelationship[] {
    return [
      ...this.inferControlLoopRelationships(),
      ...this.inferNetworkRelationships(),
      ...this.inferProcessHierarchy(),
      ...this.inferOperatorRelationships(),
      ...this.inferSafetyRelationships(),
      ...this.inferRemoteAccessPaths(),
    ];
  }

  // Build consequence chain from asset failure
  buildConsequenceChain(assetId: string): {
    trigger: Partial<CanonAsset>;
    chain: {
      asset: Partial<CanonAsset>;
      event: string;
      severity: "critical" | "high" | "medium" | "low";
    }[];
    ultimateConsequence: string;
  } | null {
    const trigger = this.assets.get(assetId);
    if (!trigger) return null;

    const chain: {
      asset: Partial<CanonAsset>;
      event: string;
      severity: "critical" | "high" | "medium" | "low";
    }[] = [];

    const visited = new Set<string>();
    const relationships = this.inferAllRelationships();

    // Build directed graph
    const graph = new Map<string, InferredRelationship[]>();
    for (const rel of relationships) {
      if (!graph.has(rel.sourceId)) {
        graph.set(rel.sourceId, []);
      }
      graph.get(rel.sourceId)!.push(rel);
    }

    // BFS to find consequence path
    const queue: { id: string; depth: number }[] = [{ id: assetId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.depth > 5) continue;
      visited.add(current.id);

      const asset = this.assets.get(current.id);
      if (!asset) continue;

      // Add to chain
      if (current.id !== assetId) {
        const event = this.describeConsequence(asset, trigger);
        chain.push({
          asset,
          event,
          severity: this.assessSeverity(asset),
        });
      }

      // Follow relationships
      const outgoing = graph.get(current.id) || [];
      for (const rel of outgoing) {
        if (!visited.has(rel.targetId)) {
          queue.push({ id: rel.targetId, depth: current.depth + 1 });
        }
      }
    }

    // Determine ultimate consequence
    const ultimateConsequence = this.determineUltimateConsequence(trigger, chain);

    return {
      trigger,
      chain,
      ultimateConsequence,
    };
  }

  private describeConsequence(affected: Partial<CanonAsset>, trigger: Partial<CanonAsset>): string {
    const triggerType = trigger.assetType;
    const affectedType = affected.assetType;

    if (triggerType?.includes("sensor") || triggerType?.includes("transmitter")) {
      return `Loss of ${trigger.tagNumber} measurement`;
    }
    if (triggerType?.includes("controller") || triggerType === "plc" || triggerType === "dcs_controller") {
      return `Loss of control from ${trigger.tagNumber}`;
    }
    if (triggerType?.includes("valve")) {
      return `${trigger.tagNumber} fails to operate`;
    }

    return `${trigger.tagNumber} failure affects ${affected.tagNumber}`;
  }

  private assessSeverity(asset: Partial<CanonAsset>): "critical" | "high" | "medium" | "low" {
    if (asset.engineering?.silRating) return "critical";
    if (asset.security?.riskTier === "critical") return "critical";
    if (asset.layer === 1) return "high"; // Physical process
    if (asset.layer === 2 && asset.assetType?.includes("safety")) return "critical";
    return asset.security?.riskTier as "critical" | "high" | "medium" | "low" || "medium";
  }

  private determineUltimateConsequence(
    trigger: Partial<CanonAsset>,
    chain: { asset: Partial<CanonAsset>; severity: string }[]
  ): string {
    // Check if chain reaches Layer 1 equipment
    const physicalAssets = chain.filter((c) => c.asset.layer === 1);

    if (physicalAssets.length > 0) {
      const equipment = physicalAssets[0].asset;
      const consequence = equipment.engineering?.consequenceOfFailure;
      if (consequence) return consequence;
      return `Process upset at ${equipment.tagNumber}`;
    }

    // Check for safety impacts
    const safetyAssets = chain.filter(
      (c) => c.asset.engineering?.silRating || c.asset.assetType?.includes("safety")
    );

    if (safetyAssets.length > 0) {
      return `Safety function degradation - ${safetyAssets[0].asset.tagNumber}`;
    }

    return `Operational impact from ${trigger.tagNumber} failure`;
  }

  // Get summary statistics
  getSummary(): {
    totalAssets: number;
    totalRelationships: number;
    controlLoops: {
      complete: number;
      partial: number;
      orphaned: number;
    };
    networkCoverage: {
      total: number;
      networked: number;
      percentage: number;
    };
    byRelationshipType: Record<string, number>;
  } {
    const relationships = this.inferAllRelationships();
    const loops = this.inferControlLoops();
    const networked = Array.from(this.assets.values()).filter(
      (a) => a.network?.ipAddress
    ).length;

    const byType: Record<string, number> = {};
    for (const rel of relationships) {
      byType[rel.relationshipType] = (byType[rel.relationshipType] || 0) + 1;
    }

    return {
      totalAssets: this.assets.size,
      totalRelationships: relationships.length,
      controlLoops: {
        complete: loops.filter((l) => l.status === "complete").length,
        partial: loops.filter((l) => l.status === "partial").length,
        orphaned: loops.filter((l) => l.status === "orphaned").length,
      },
      networkCoverage: {
        total: this.assets.size,
        networked,
        percentage: Math.round((networked / this.assets.size) * 100),
      },
      byRelationshipType: byType,
    };
  }
}

// Export factory function
export function createRelationshipEngine(assets: Partial<CanonAsset>[]) {
  return new RelationshipInferenceEngine(assets);
}
