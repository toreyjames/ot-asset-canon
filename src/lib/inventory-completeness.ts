// Inventory Completeness Engine
// Determines if we have enough context to "run the plant"
// Based on realistic engineering requirements

import type { CanonAsset, AssetType, CanonLayer } from "@/types/canon";

// Plant type inference based on equipment and process variables
export type PlantType =
  | "chemical"
  | "petrochemical"
  | "refinery"
  | "power_generation"
  | "water_treatment"
  | "wastewater"
  | "pharmaceutical"
  | "food_beverage"
  | "pulp_paper"
  | "metals_mining"
  | "oil_gas_upstream"
  | "oil_gas_midstream"
  | "manufacturing"
  | "unknown";

// Equipment signatures that indicate plant type
const PLANT_TYPE_SIGNATURES: Record<PlantType, {
  equipmentKeywords: string[];
  processVariables: string[];
  vendorPatterns: string[];
  tagPatterns: RegExp[];
}> = {
  chemical: {
    equipmentKeywords: ["reactor", "distillation", "crystallizer", "absorber", "stripper", "evaporator", "column", "heat exchanger"],
    processVariables: ["reaction temperature", "catalyst", "pH", "concentration"],
    vendorPatterns: ["honeywell", "emerson", "yokogawa", "abb"],
    tagPatterns: [/^R-\d+/, /^T-\d+/, /^E-\d+/, /^V-\d+/, /^P-\d+/, /^C-\d+/],
  },
  refinery: {
    equipmentKeywords: ["crude", "fractionator", "hydrotreater", "reformer", "coker", "fcc", "alkylation"],
    processVariables: ["crude temperature", "vacuum", "octane", "sulfur"],
    vendorPatterns: ["honeywell", "emerson", "yokogawa"],
    tagPatterns: [/^CDU/, /^VDU/, /^HDS/, /^FCC/],
  },
  power_generation: {
    equipmentKeywords: ["turbine", "generator", "boiler", "condenser", "feedwater", "hrsg"],
    processVariables: ["megawatts", "steam pressure", "grid frequency", "load"],
    vendorPatterns: ["ge", "siemens", "abb", "sel", "schweitzer"],
    tagPatterns: [/^GT-/, /^ST-/, /^GEN-/, /^BLR-/],
  },
  water_treatment: {
    equipmentKeywords: ["clarifier", "filter", "chlorinator", "fluoride", "membrane", "uv"],
    processVariables: ["turbidity", "chlorine residual", "pH", "tds", "flow"],
    vendorPatterns: ["hach", "xylem", "evoqua", "suez"],
    tagPatterns: [/^CLR-/, /^FLT-/, /^PMP-/, /^CL2/],
  },
  wastewater: {
    equipmentKeywords: ["aeration", "digester", "clarifier", "sludge", "dewatering", "blower"],
    processVariables: ["dissolved oxygen", "bod", "tss", "ammonia", "phosphorus"],
    vendorPatterns: ["hach", "xylem", "evoqua"],
    tagPatterns: [/^AER-/, /^DIG-/, /^BLR-/],
  },
  pharmaceutical: {
    equipmentKeywords: ["bioreactor", "fermenter", "centrifuge", "lyophilizer", "autoclave", "cleanroom"],
    processVariables: ["sterility", "batch", "cip", "sip"],
    vendorPatterns: ["emerson", "rockwell", "siemens"],
    tagPatterns: [/^BR-/, /^FRM-/, /^CIP/],
  },
  oil_gas_upstream: {
    equipmentKeywords: ["wellhead", "separator", "treater", "compressor", "flare"],
    processVariables: ["wellhead pressure", "gas lift", "water cut"],
    vendorPatterns: ["emerson", "abb", "honeywell"],
    tagPatterns: [/^WH-/, /^SEP-/, /^COMP-/],
  },
  oil_gas_midstream: {
    equipmentKeywords: ["pipeline", "compressor station", "meter station", "pig launcher"],
    processVariables: ["line pressure", "flow rate", "custody transfer"],
    vendorPatterns: ["emerson", "abb", "honeywell"],
    tagPatterns: [/^PL-/, /^CS-/, /^MS-/],
  },
  petrochemical: {
    equipmentKeywords: ["cracker", "polymerization", "ethylene", "propylene"],
    processVariables: ["conversion", "selectivity", "polymer grade"],
    vendorPatterns: ["honeywell", "emerson", "yokogawa"],
    tagPatterns: [/^CR-/, /^POLY-/],
  },
  food_beverage: {
    equipmentKeywords: ["pasteurizer", "fermenter", "bottling", "cip", "homogenizer"],
    processVariables: ["brix", "pasteurization", "fill level"],
    vendorPatterns: ["rockwell", "siemens", "omron"],
    tagPatterns: [/^PAST-/, /^FILL-/, /^CIP/],
  },
  pulp_paper: {
    equipmentKeywords: ["digester", "bleaching", "paper machine", "dryer", "calender"],
    processVariables: ["kappa", "brightness", "basis weight", "moisture"],
    vendorPatterns: ["honeywell", "abb", "valmet"],
    tagPatterns: [/^DIG-/, /^PM-/, /^DRY-/],
  },
  metals_mining: {
    equipmentKeywords: ["crusher", "mill", "flotation", "leach", "smelter", "conveyor"],
    processVariables: ["grade", "recovery", "particle size"],
    vendorPatterns: ["abb", "siemens", "rockwell"],
    tagPatterns: [/^CR-/, /^ML-/, /^CONV-/],
  },
  manufacturing: {
    equipmentKeywords: ["cnc", "robot", "assembly", "conveyor", "press"],
    processVariables: ["cycle time", "throughput", "quality"],
    vendorPatterns: ["rockwell", "siemens", "fanuc", "omron"],
    tagPatterns: [/^CNC-/, /^ROB-/, /^CONV-/],
  },
  unknown: {
    equipmentKeywords: [],
    processVariables: [],
    vendorPatterns: [],
    tagPatterns: [],
  },
};

// REALISTIC requirements for running a plant
// Based on actual chemical/process industry standards
interface LayerRequirements {
  layer: CanonLayer;
  name: string;
  requiredCategories: {
    category: string;
    description: string;
    minCount: number;
    assetTypes: AssetType[];
    critical: boolean;
  }[];
  // Ratios matter - these are industry norms
  ratioChecks?: {
    description: string;
    numerator: AssetType[];
    denominator: AssetType[];
    minRatio: number;
    severity: "critical" | "warning";
  }[];
}

const LAYER_REQUIREMENTS: LayerRequirements[] = [
  {
    layer: 1,
    name: "Physical Process",
    requiredCategories: [
      {
        category: "Primary Process Equipment",
        description: "Main unit operations (reactors, columns, vessels)",
        minCount: 3, // Realistic: multiple vessels minimum
        assetTypes: ["reactor", "column", "vessel", "tank"],
        critical: true,
      },
      {
        category: "Heat Transfer Equipment",
        description: "Heat exchangers, coolers, heaters",
        minCount: 2,
        assetTypes: ["heat_exchanger", "cooler", "heater"],
        critical: true,
      },
      {
        category: "Rotating Equipment",
        description: "Pumps, compressors, blowers",
        minCount: 4, // Minimum for any real plant
        assetTypes: ["pump", "compressor", "blower", "fan"],
        critical: true,
      },
      {
        category: "Storage",
        description: "Feed/product storage tanks",
        minCount: 2,
        assetTypes: ["tank", "silo", "storage_vessel"],
        critical: true,
      },
      {
        category: "Safety Systems",
        description: "Flare, relief systems",
        minCount: 1,
        assetTypes: ["flare", "relief_header", "scrubber"],
        critical: true,
      },
    ],
  },
  {
    layer: 2,
    name: "Instrumentation & Actuation",
    requiredCategories: [
      {
        category: "Temperature Measurement",
        description: "Temperature sensors/transmitters (TT, TI, TIC)",
        minCount: 10, // Real plant has many
        assetTypes: ["temperature_sensor"],
        critical: true,
      },
      {
        category: "Pressure Measurement",
        description: "Pressure sensors/transmitters (PT, PI, PIC)",
        minCount: 8,
        assetTypes: ["pressure_sensor"],
        critical: true,
      },
      {
        category: "Flow Measurement",
        description: "Flow meters/transmitters (FT, FI, FIC)",
        minCount: 6,
        assetTypes: ["flow_sensor"],
        critical: true,
      },
      {
        category: "Level Measurement",
        description: "Level sensors/transmitters (LT, LI, LIC)",
        minCount: 6,
        assetTypes: ["level_sensor"],
        critical: true,
      },
      {
        category: "Control Valves",
        description: "Final control elements (TV, PV, FV, LV)",
        minCount: 8,
        assetTypes: ["control_valve"],
        critical: true,
      },
      {
        category: "Safety Shutdown Valves",
        description: "Emergency isolation valves (SDV, BDV, XV)",
        minCount: 3,
        assetTypes: ["shutdown_valve", "blowdown_valve", "isolation_valve"],
        critical: true,
      },
      {
        category: "Relief Valves",
        description: "Pressure safety valves (PSV)",
        minCount: 2,
        assetTypes: ["relief_valve", "safety_valve"],
        critical: true,
      },
      {
        category: "Analyzers",
        description: "Process analyzers (AT, AIC)",
        minCount: 1,
        assetTypes: ["analyzer", "analytical_sensor"],
        critical: false,
      },
    ],
    ratioChecks: [
      {
        description: "Instruments per equipment piece",
        numerator: ["temperature_sensor", "pressure_sensor", "flow_sensor", "level_sensor"],
        denominator: ["reactor", "column", "vessel", "tank", "heat_exchanger"],
        minRatio: 2.0, // At least 2 instruments per major equipment
        severity: "critical",
      },
      {
        description: "Control valves per controller",
        numerator: ["control_valve"],
        denominator: ["plc", "dcs_controller"],
        minRatio: 3.0, // Each controller should drive multiple valves
        severity: "warning",
      },
    ],
  },
  {
    layer: 3,
    name: "Control Systems",
    requiredCategories: [
      {
        category: "Process Controllers",
        description: "DCS controllers or PLCs for process control",
        minCount: 2, // Redundancy expected
        assetTypes: ["plc", "dcs_controller", "rtu"],
        critical: true,
      },
      {
        category: "Safety Controllers",
        description: "SIS/Safety PLCs - required for SIL-rated loops",
        minCount: 1,
        assetTypes: ["safety_controller", "safety_plc", "sis_controller"],
        critical: true, // Cannot run hazardous process without SIS
      },
      {
        category: "Remote I/O",
        description: "Field I/O marshalling",
        minCount: 2,
        assetTypes: ["remote_io", "io_module", "marshalling_cabinet"],
        critical: false,
      },
    ],
  },
  {
    layer: 4,
    name: "Operations & Monitoring",
    requiredCategories: [
      {
        category: "Operator Stations",
        description: "HMI consoles for operators",
        minCount: 2, // Minimum for 24/7 operations
        assetTypes: ["hmi", "operator_station"],
        critical: true,
      },
      {
        category: "Engineering Workstations",
        description: "EWS for control system programming",
        minCount: 1,
        assetTypes: ["engineering_workstation"],
        critical: true,
      },
      {
        category: "Data Historian",
        description: "Process data archival",
        minCount: 1,
        assetTypes: ["historian"],
        critical: true, // Required for regulatory compliance
      },
      {
        category: "Application Servers",
        description: "DCS servers, OPC servers, etc.",
        minCount: 1,
        assetTypes: ["server", "application_server"],
        critical: true,
      },
    ],
  },
  {
    layer: 5,
    name: "Network Infrastructure",
    requiredCategories: [
      {
        category: "Industrial Switches",
        description: "OT network switching infrastructure",
        minCount: 4, // Multiple levels need switches
        assetTypes: ["switch", "industrial_switch"],
        critical: true,
      },
      {
        category: "Firewalls",
        description: "Network segmentation between levels",
        minCount: 2, // DMZ and control network boundaries
        assetTypes: ["firewall"],
        critical: true,
      },
      {
        category: "DMZ Infrastructure",
        description: "Jump servers, data diodes",
        minCount: 1,
        assetTypes: ["jump_server", "data_diode", "bastion_host"],
        critical: false,
      },
    ],
  },
  {
    layer: 6,
    name: "Enterprise Integration",
    requiredCategories: [
      {
        category: "Remote Access",
        description: "VPN concentrators for remote support",
        minCount: 1,
        assetTypes: ["vpn_concentrator", "remote_access"],
        critical: false, // Not required to run plant
      },
      {
        category: "Business Integration",
        description: "MES, ERP connectivity",
        minCount: 0,
        assetTypes: ["mes_server", "erp_gateway"],
        critical: false,
      },
    ],
  },
];

// Completeness check results
export interface CompletenessResult {
  overallScore: number;
  canRunPlant: boolean;
  inferredPlantType: PlantType;
  plantTypeConfidence: number;

  layerScores: {
    layer: CanonLayer;
    name: string;
    score: number;
    assetCount: number;
    status: "complete" | "partial" | "missing";
    gaps: {
      category: string;
      description: string;
      severity: "critical" | "warning" | "info";
      have: number;
      need: number;
      suggestion: string;
    }[];
  }[];

  processUnderstanding: {
    identifiedProcesses: string[];
    identifiedEquipment: string[];
    controlLoops: {
      complete: number;
      partial: number;
      orphaned: number;
    };
  };

  criticalGapCount: number;
  warningGapCount: number;
  recommendations: string[];
}

// Infer plant type from inventory
export function inferPlantType(assets: Partial<CanonAsset>[]): {
  type: PlantType;
  confidence: number;
  evidence: string[];
} {
  const scores: Record<PlantType, { score: number; evidence: string[] }> = {} as Record<PlantType, { score: number; evidence: string[] }>;

  for (const plantType of Object.keys(PLANT_TYPE_SIGNATURES) as PlantType[]) {
    scores[plantType] = { score: 0, evidence: [] };
  }

  for (const asset of assets) {
    const assetText = `${asset.name || ""} ${asset.tagNumber || ""} ${asset.description || ""} ${
      asset.controlSystem?.controllerMake || ""
    }`.toLowerCase();

    for (const [plantType, signature] of Object.entries(PLANT_TYPE_SIGNATURES) as [PlantType, typeof PLANT_TYPE_SIGNATURES[PlantType]][]) {
      for (const keyword of signature.equipmentKeywords) {
        if (assetText.includes(keyword.toLowerCase())) {
          scores[plantType].score += 10;
          if (!scores[plantType].evidence.includes(`Equipment: ${keyword}`)) {
            scores[plantType].evidence.push(`Equipment: ${keyword}`);
          }
        }
      }

      for (const vendor of signature.vendorPatterns) {
        if (assetText.includes(vendor.toLowerCase())) {
          scores[plantType].score += 3;
          if (!scores[plantType].evidence.includes(`Vendor: ${vendor}`)) {
            scores[plantType].evidence.push(`Vendor: ${vendor}`);
          }
        }
      }

      for (const pattern of signature.tagPatterns) {
        if (asset.tagNumber && pattern.test(asset.tagNumber)) {
          scores[plantType].score += 5;
          if (!scores[plantType].evidence.includes(`Tag: ${asset.tagNumber}`)) {
            scores[plantType].evidence.push(`Tag: ${asset.tagNumber}`);
          }
        }
      }
    }
  }

  let bestType: PlantType = "unknown";
  let bestScore = 0;

  for (const [plantType, data] of Object.entries(scores)) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestType = plantType as PlantType;
    }
  }

  // More realistic confidence calculation
  const evidenceCount = scores[bestType]?.evidence.length || 0;
  const confidence = Math.min(95, Math.round(evidenceCount * 8 + bestScore / 2));

  return {
    type: bestType,
    confidence,
    evidence: scores[bestType]?.evidence.slice(0, 15) || [],
  };
}

// Check inventory completeness
export function checkInventoryCompleteness(
  assets: Partial<CanonAsset>[]
): CompletenessResult {
  const plantTypeResult = inferPlantType(assets);

  // Group assets by layer
  const assetsByLayer = new Map<CanonLayer, Partial<CanonAsset>[]>();
  for (const layer of [1, 2, 3, 4, 5, 6] as CanonLayer[]) {
    assetsByLayer.set(layer, []);
  }
  for (const asset of assets) {
    const layer = asset.layer as CanonLayer;
    if (layer && assetsByLayer.has(layer)) {
      assetsByLayer.get(layer)!.push(asset);
    }
  }

  const layerScores: CompletenessResult["layerScores"] = [];
  let criticalGapCount = 0;
  let warningGapCount = 0;

  for (const requirement of LAYER_REQUIREMENTS) {
    const layerAssets = assetsByLayer.get(requirement.layer) || [];
    const gaps: CompletenessResult["layerScores"][0]["gaps"] = [];
    let categoryScores = 0;
    let totalWeight = 0;

    for (const category of requirement.requiredCategories) {
      const weight = category.critical ? 2 : 1;
      totalWeight += weight;

      const matchingAssets = layerAssets.filter((a) =>
        category.assetTypes.includes(a.assetType as AssetType)
      );

      const have = matchingAssets.length;
      const need = category.minCount;

      if (have >= need) {
        categoryScores += weight;
      } else if (have > 0) {
        categoryScores += weight * (have / need);
        const severity = category.critical ? "critical" : "warning";
        if (category.critical) criticalGapCount++;
        else warningGapCount++;

        gaps.push({
          category: category.category,
          description: category.description,
          severity,
          have,
          need,
          suggestion: `Need ${need - have} more ${category.description.toLowerCase()}`,
        });
      } else if (category.minCount > 0) {
        const severity = category.critical ? "critical" : "warning";
        if (category.critical) criticalGapCount++;
        else warningGapCount++;

        gaps.push({
          category: category.category,
          description: category.description,
          severity,
          have: 0,
          need,
          suggestion: `Missing ${category.description.toLowerCase()} - need at least ${need}`,
        });
      }
    }

    // Check ratio requirements
    if (requirement.ratioChecks) {
      for (const check of requirement.ratioChecks) {
        const numeratorCount = assets.filter((a) =>
          check.numerator.includes(a.assetType as AssetType)
        ).length;
        const denominatorCount = assets.filter((a) =>
          check.denominator.includes(a.assetType as AssetType)
        ).length;

        if (denominatorCount > 0) {
          const ratio = numeratorCount / denominatorCount;
          if (ratio < check.minRatio) {
            if (check.severity === "critical") criticalGapCount++;
            else warningGapCount++;

            gaps.push({
              category: "Ratio Check",
              description: check.description,
              severity: check.severity,
              have: Math.round(ratio * 10) / 10,
              need: check.minRatio,
              suggestion: `${check.description}: have ${ratio.toFixed(1)}, need ${check.minRatio}`,
            });
          }
        }
      }
    }

    const score = totalWeight > 0
      ? Math.round((categoryScores / totalWeight) * 100)
      : 100;

    layerScores.push({
      layer: requirement.layer,
      name: requirement.name,
      score,
      assetCount: layerAssets.length,
      status: score >= 90 ? "complete" : score >= 50 ? "partial" : "missing",
      gaps,
    });
  }

  // Analyze control loops more realistically
  const sensors = assets.filter((a) =>
    ["temperature_sensor", "pressure_sensor", "flow_sensor", "level_sensor", "analyzer"].includes(
      a.assetType as string
    )
  );
  const controllers = assets.filter((a) =>
    ["plc", "dcs_controller", "rtu", "safety_controller"].includes(a.assetType as string)
  );
  const actuators = assets.filter((a) =>
    ["control_valve", "shutdown_valve", "blowdown_valve"].includes(a.assetType as string)
  );

  // More realistic loop analysis
  // A controller can handle ~20-50 loops
  const estimatedLoops = Math.min(sensors.length, actuators.length);
  const loopCapacity = controllers.length * 30; // Assume 30 loops per controller
  const completeLoops = Math.min(estimatedLoops, loopCapacity);
  const partialLoops = Math.abs(sensors.length - actuators.length);
  const orphaned = Math.max(0, sensors.length - loopCapacity) + Math.max(0, actuators.length - loopCapacity);

  // Calculate overall score with weighted layers
  // Layers 1-3 are critical for operations
  const weights = { 1: 0.20, 2: 0.25, 3: 0.25, 4: 0.15, 5: 0.10, 6: 0.05 };
  let weightedScore = 0;
  for (const ls of layerScores) {
    weightedScore += ls.score * (weights[ls.layer as keyof typeof weights] || 0);
  }
  const overallScore = Math.round(weightedScore);

  // Can only run plant if:
  // 1. No critical gaps
  // 2. Overall score >= 75
  // 3. Layers 1-3 each >= 70
  const layers1to3Complete = layerScores
    .filter((ls) => ls.layer <= 3)
    .every((ls) => ls.score >= 70);

  const canRunPlant = criticalGapCount === 0 && overallScore >= 75 && layers1to3Complete;

  // Build recommendations
  const recommendations: string[] = [];

  if (criticalGapCount > 0) {
    recommendations.push(`${criticalGapCount} critical gaps must be resolved before plant can operate.`);
  }

  if (!layers1to3Complete) {
    recommendations.push("Physical process, instrumentation, and control layers are incomplete.");
  }

  for (const ls of layerScores) {
    for (const gap of ls.gaps.filter((g) => g.severity === "critical")) {
      recommendations.push(`L${ls.layer}: ${gap.suggestion}`);
    }
  }

  if (controllers.length < 2) {
    recommendations.push("Insufficient controller redundancy for continuous operations.");
  }

  if (assets.filter((a) => a.assetType === "historian").length === 0) {
    recommendations.push("No historian identified - required for regulatory compliance and troubleshooting.");
  }

  const sisControllers = assets.filter((a) =>
    ["safety_controller", "safety_plc", "sis_controller"].includes(a.assetType as string)
  );
  if (sisControllers.length === 0) {
    recommendations.push("No Safety Instrumented System (SIS) identified - required for hazardous processes.");
  }

  const firewalls = assets.filter((a) => a.assetType === "firewall");
  if (firewalls.length < 2) {
    recommendations.push("Insufficient network segmentation - need firewalls between Purdue levels.");
  }

  // Identify processes
  const identifiedProcesses: string[] = [];
  const identifiedEquipment: string[] = [];

  for (const asset of assets) {
    if (asset.engineering?.processArea && !identifiedProcesses.includes(asset.engineering.processArea)) {
      identifiedProcesses.push(asset.engineering.processArea);
    }
    if (asset.name && asset.layer === 1) {
      identifiedEquipment.push(asset.name);
    }
  }

  return {
    overallScore,
    canRunPlant,
    inferredPlantType: plantTypeResult.type,
    plantTypeConfidence: plantTypeResult.confidence,
    layerScores,
    processUnderstanding: {
      identifiedProcesses,
      identifiedEquipment,
      controlLoops: {
        complete: completeLoops,
        partial: partialLoops,
        orphaned,
      },
    },
    criticalGapCount,
    warningGapCount,
    recommendations: recommendations.slice(0, 10),
  };
}

// Gap analysis
export interface GapAnalysis {
  missingInstrumentation: {
    processArea: string;
    expectedInstruments: string[];
    reason: string;
  }[];
  uncontrolledEquipment: {
    equipment: string;
    expectedControls: string[];
  }[];
  networkBlindSpots: {
    description: string;
    likelyAssets: string[];
  }[];
}

export function analyzeGaps(
  assets: Partial<CanonAsset>[],
  plantType: PlantType
): GapAnalysis {
  const analysis: GapAnalysis = {
    missingInstrumentation: [],
    uncontrolledEquipment: [],
    networkBlindSpots: [],
  };

  const equipment = assets.filter((a) => a.layer === 1);
  const instruments = assets.filter((a) => a.layer === 2);

  // Check each piece of equipment for associated instrumentation
  for (const equip of equipment) {
    // Skip storage tanks and non-critical equipment
    if (["tank", "storage_vessel", "silo"].includes(equip.assetType as string)) {
      continue;
    }

    // Find instruments that reference this equipment or share process area
    const relatedInstruments = instruments.filter((i) => {
      const sameArea = i.engineering?.processArea === equip.engineering?.processArea;
      const sameLoop = i.tagNumber?.includes(equip.tagNumber?.replace(/[A-Z]-/, "") || "XXX");
      return sameArea || sameLoop;
    });

    // Critical equipment should have multiple instruments
    if (["reactor", "column", "compressor"].includes(equip.assetType as string)) {
      if (relatedInstruments.length < 3) {
        analysis.uncontrolledEquipment.push({
          equipment: `${equip.tagNumber} - ${equip.name}`,
          expectedControls: ["Temperature", "Pressure", "Level/Flow", "Safety trips"],
        });
      }
    }
  }

  // Check network visibility
  const controllers = assets.filter((a) => a.layer === 3);
  const networkDevices = assets.filter((a) => a.layer === 5);

  const controllersWithIP = controllers.filter((c) => c.network?.ipAddress);
  const controllersWithoutIP = controllers.filter((c) => !c.network?.ipAddress);

  if (controllersWithoutIP.length > 0) {
    analysis.networkBlindSpots.push({
      description: `${controllersWithoutIP.length} controllers without network info`,
      likelyAssets: controllersWithoutIP.map((c) => c.tagNumber || "Unknown"),
    });
  }

  // Check for VLANs without switches
  const vlans = new Set<number>();
  for (const asset of assets) {
    if (asset.network?.vlan) {
      vlans.add(asset.network.vlan);
    }
  }

  const switchVlans = new Set<number>();
  for (const sw of networkDevices.filter((n) => n.assetType === "switch")) {
    if (sw.network?.vlan) {
      switchVlans.add(sw.network.vlan);
    }
  }

  for (const vlan of vlans) {
    if (!switchVlans.has(vlan)) {
      analysis.networkBlindSpots.push({
        description: `VLAN ${vlan} has assets but no identified switch`,
        likelyAssets: ["Unknown switch infrastructure"],
      });
    }
  }

  return analysis;
}
