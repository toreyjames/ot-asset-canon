/**
 * Plant Reconstruction Engine
 *
 * Uses asset inventory data + process engineering OSINT to:
 * 1. Infer what kind of plant this is
 * 2. Reconstruct the process flow
 * 3. Identify control strategies
 * 4. Map safety functions
 * 5. Find what's missing
 */

import type { CanonAsset } from "@/types/canon";

// ============================================================================
// PROCESS SIGNATURES - OSINT-derived patterns that identify plant types
// ============================================================================
export interface ProcessSignature {
  processType: string;
  industryCategory: string;
  description: string;
  requiredEquipment: string[];
  typicalInstrumentation: string[];
  controlStrategies: string[];
  hazards: string[];
  typicalProducts: string[];
  chemicalMarkers: string[];
  confidence: number;
}

// Process signatures derived from engineering literature and industry standards
const PROCESS_SIGNATURES: ProcessSignature[] = [
  {
    processType: "Olefin Polymerization",
    industryCategory: "Petrochemical",
    description: "Continuous polymerization of ethylene or propylene to produce polyethylene/polypropylene",
    requiredEquipment: ["reactor", "compressor", "heat_exchanger", "column", "separator"],
    typicalInstrumentation: ["TIC", "PIC", "FIC", "LIC", "AT"],
    controlStrategies: [
      "Reactor temperature cascade control (TIC → cooling water valve)",
      "Pressure control via recycle compressor speed",
      "Catalyst feed ratio control",
      "Product property control via APC"
    ],
    hazards: [
      "Runaway polymerization (exothermic)",
      "Ethylene decomposition (explosive)",
      "High pressure equipment failure",
      "Loss of cooling"
    ],
    typicalProducts: ["HDPE", "LDPE", "LLDPE", "PP"],
    chemicalMarkers: ["ethylene", "propylene", "hydrogen", "hexene", "butene"],
    confidence: 0
  },
  {
    processType: "Hydrocarbon Cracking",
    industryCategory: "Refinery/Petrochemical",
    description: "Thermal or catalytic cracking of heavy hydrocarbons to lighter products",
    requiredEquipment: ["reactor", "column", "heat_exchanger", "compressor", "drum"],
    typicalInstrumentation: ["TIC", "PIC", "FIC", "AT", "PDT"],
    controlStrategies: [
      "Reactor outlet temperature control",
      "Quench system control",
      "Fractionation column pressure control",
      "Recycle ratio control"
    ],
    hazards: [
      "Coking/fouling",
      "Tube rupture",
      "High temperature hydrogen attack",
      "Flammable vapor release"
    ],
    typicalProducts: ["Ethylene", "Propylene", "Butadiene", "BTX"],
    chemicalMarkers: ["naphtha", "ethane", "propane", "pygas"],
    confidence: 0
  },
  {
    processType: "Continuous Stirred Reactor (CSTR)",
    industryCategory: "Chemical Manufacturing",
    description: "Continuous reaction with back-mixing for chemical synthesis",
    requiredEquipment: ["reactor", "heat_exchanger", "pump", "vessel", "agitator"],
    typicalInstrumentation: ["TIC", "LIC", "FIC", "PIC", "AT"],
    controlStrategies: [
      "Residence time control via level",
      "Reaction temperature control",
      "Stoichiometric ratio control",
      "Product quality via APC"
    ],
    hazards: [
      "Runaway reaction",
      "Loss of agitation",
      "Reactant accumulation",
      "Off-spec product"
    ],
    typicalProducts: ["Intermediates", "Specialty chemicals"],
    chemicalMarkers: [],
    confidence: 0
  },
  {
    processType: "Distillation/Fractionation",
    industryCategory: "Petrochemical/Refinery",
    description: "Separation of mixtures by volatility difference",
    requiredEquipment: ["column", "heat_exchanger", "vessel", "pump"],
    typicalInstrumentation: ["TIC", "PIC", "LIC", "FIC", "PDT", "AT"],
    controlStrategies: [
      "Column pressure control (vent/condenser)",
      "Reflux ratio control",
      "Reboiler duty control",
      "Product composition control via temperature"
    ],
    hazards: [
      "Column flooding",
      "Loss of reflux",
      "Reboiler tube failure",
      "Off-spec products"
    ],
    typicalProducts: ["Purified fractions", "Overhead/bottoms products"],
    chemicalMarkers: [],
    confidence: 0
  },
  {
    processType: "Alkylation",
    industryCategory: "Refinery",
    description: "Acid-catalyzed reaction to produce high-octane gasoline",
    requiredEquipment: ["reactor", "settler", "column", "heat_exchanger", "acid_tank"],
    typicalInstrumentation: ["TIC", "FIC", "LIC", "AT", "pH"],
    controlStrategies: [
      "Acid strength control",
      "Isobutane/olefin ratio control",
      "Reaction temperature control",
      "Acid inventory control"
    ],
    hazards: [
      "HF/H2SO4 release (highly toxic/corrosive)",
      "Runaway reaction",
      "Acid carryover",
      "Red oil formation"
    ],
    typicalProducts: ["Alkylate"],
    chemicalMarkers: ["HF", "H2SO4", "isobutane", "olefin"],
    confidence: 0
  },
];

// ============================================================================
// CONTROL LOOP PATTERNS
// ============================================================================
interface ControlLoop {
  loopId: string;
  loopType: "regulatory" | "cascade" | "ratio" | "feedforward" | "override" | "safety";
  primaryVariable: string;
  manipulatedVariable: string;
  processArea: string;
  setpointSource: "operator" | "apc" | "cascade_master" | "safety";
  criticalityRating: "low" | "medium" | "high" | "safety_critical";
  description: string;
}

// ============================================================================
// PROCESS FLOW INFERENCE
// ============================================================================
interface ProcessUnit {
  unitId: string;
  unitName: string;
  unitType: string;
  feedStreams: string[];
  productStreams: string[];
  equipment: string[];
  instrumentation: string[];
  controlLoops: string[];
  safetyFunctions: string[];
  upstreamUnits: string[];
  downstreamUnits: string[];
}

interface ProcessFlowDiagram {
  units: ProcessUnit[];
  streams: {
    streamId: string;
    from: string;
    to: string;
    phase: "liquid" | "vapor" | "two-phase" | "solid";
    service: string;
  }[];
  utilityConnections: {
    utility: string;
    consumers: string[];
  }[];
}

// ============================================================================
// MAIN RECONSTRUCTION FUNCTION
// ============================================================================
export interface PlantReconstruction {
  inferredProcessType: ProcessSignature;
  processFlow: ProcessFlowDiagram;
  controlLoops: ControlLoop[];
  safetyFunctions: SafetyFunction[];
  missingAssets: MissingAsset[];
  attackSurfaces: AttackSurface[];
  confidenceScore: number;
  reconstructionNotes: string[];
}

interface SafetyFunction {
  sifId: string;
  description: string;
  silRating: string;
  initiators: string[];
  logicSolver: string;
  finalElements: string[];
  protectedEquipment: string;
  hazardMitigated: string;
  status: "complete" | "partial" | "inferred";
}

interface MissingAsset {
  category: string;
  expectedAsset: string;
  reason: string;
  severity: "critical" | "warning" | "info";
  osintSource: string;
}

interface AttackSurface {
  entryPoint: string;
  assetId: string;
  attackVector: string;
  potentialImpact: string;
  physicalConsequence: string;
  mitigations: string[];
}

export function reconstructPlant(assets: Partial<CanonAsset>[]): PlantReconstruction {
  // Step 1: Categorize assets
  const categorizedAssets = categorizeAssets(assets);

  // Step 2: Identify process type from equipment signatures
  const processType = identifyProcessType(categorizedAssets);

  // Step 3: Reconstruct process flow
  const processFlow = reconstructProcessFlow(categorizedAssets);

  // Step 4: Identify control loops
  const controlLoops = identifyControlLoops(assets);

  // Step 5: Map safety functions
  const safetyFunctions = mapSafetyFunctions(assets);

  // Step 6: Identify missing assets based on process type
  const missingAssets = identifyMissingAssets(categorizedAssets, processType);

  // Step 7: Identify attack surfaces
  const attackSurfaces = identifyAttackSurfaces(assets, processFlow, safetyFunctions);

  // Step 8: Calculate confidence score
  const confidenceScore = calculateConfidence(categorizedAssets, processType, controlLoops);

  return {
    inferredProcessType: processType,
    processFlow,
    controlLoops,
    safetyFunctions,
    missingAssets,
    attackSurfaces,
    confidenceScore,
    reconstructionNotes: generateNotes(categorizedAssets, processType)
  };
}

interface CategorizedAssets {
  reactors: Partial<CanonAsset>[];
  columns: Partial<CanonAsset>[];
  heatExchangers: Partial<CanonAsset>[];
  vessels: Partial<CanonAsset>[];
  pumps: Partial<CanonAsset>[];
  compressors: Partial<CanonAsset>[];
  tanks: Partial<CanonAsset>[];
  instruments: Partial<CanonAsset>[];
  controllers: Partial<CanonAsset>[];
  safetyDevices: Partial<CanonAsset>[];
  networkDevices: Partial<CanonAsset>[];
  servers: Partial<CanonAsset>[];
  processAreas: Set<string>;
}

function categorizeAssets(assets: Partial<CanonAsset>[]): CategorizedAssets {
  const categorized: CategorizedAssets = {
    reactors: [],
    columns: [],
    heatExchangers: [],
    vessels: [],
    pumps: [],
    compressors: [],
    tanks: [],
    instruments: [],
    controllers: [],
    safetyDevices: [],
    networkDevices: [],
    servers: [],
    processAreas: new Set()
  };

  for (const asset of assets) {
    // Track process areas
    if (asset.engineering?.processArea) {
      categorized.processAreas.add(asset.engineering.processArea);
    }

    // Categorize by type
    switch (asset.assetType) {
      case "reactor":
        categorized.reactors.push(asset);
        break;
      case "column":
        categorized.columns.push(asset);
        break;
      case "heat_exchanger":
        categorized.heatExchangers.push(asset);
        break;
      case "vessel":
        categorized.vessels.push(asset);
        break;
      case "pump":
        categorized.pumps.push(asset);
        break;
      case "compressor":
        categorized.compressors.push(asset);
        break;
      case "tank":
        categorized.tanks.push(asset);
        break;
      case "dcs_controller":
      case "plc":
      case "safety_controller":
        categorized.controllers.push(asset);
        break;
      case "switch":
      case "firewall":
      case "router":
      case "wireless_access_point":
        categorized.networkDevices.push(asset);
        break;
      case "hmi":
      case "historian":
      case "server":
      case "engineering_workstation":
        categorized.servers.push(asset);
        break;
    }

    // Categorize instruments
    if (asset.layer === 2) {
      categorized.instruments.push(asset);

      // Check for safety devices
      if (asset.engineering?.silRating ||
          asset.assetType?.includes("shutdown") ||
          asset.assetType?.includes("relief") ||
          asset.tagNumber?.match(/^(PSV|SDV|BDV|TSHH|PSHH|LSHH)/)) {
        categorized.safetyDevices.push(asset);
      }
    }
  }

  return categorized;
}

function identifyProcessType(categorized: CategorizedAssets): ProcessSignature {
  // Clone signatures and calculate confidence for each
  const scoredSignatures = PROCESS_SIGNATURES.map(sig => ({
    ...sig,
    confidence: calculateSignatureConfidence(sig, categorized)
  }));

  // Sort by confidence
  scoredSignatures.sort((a, b) => b.confidence - a.confidence);

  // Return best match
  return scoredSignatures[0];
}

function calculateSignatureConfidence(
  signature: ProcessSignature,
  categorized: CategorizedAssets
): number {
  let score = 0;
  let maxScore = 0;

  // Check required equipment
  const equipmentPresent = {
    reactor: categorized.reactors.length > 0,
    compressor: categorized.compressors.length > 0,
    heat_exchanger: categorized.heatExchangers.length > 0,
    column: categorized.columns.length > 0,
    separator: categorized.vessels.some(v =>
      v.name?.toLowerCase().includes("separator") ||
      v.tagNumber?.startsWith("V-")
    ),
    vessel: categorized.vessels.length > 0,
    pump: categorized.pumps.length > 0,
    drum: categorized.vessels.some(v => v.name?.toLowerCase().includes("drum")),
    tank: categorized.tanks.length > 0,
    settler: categorized.vessels.some(v => v.name?.toLowerCase().includes("settler")),
    acid_tank: categorized.tanks.some(t => t.name?.toLowerCase().includes("acid")),
    agitator: categorized.reactors.some(r =>
      r.name?.toLowerCase().includes("stirred") || r.name?.toLowerCase().includes("cstr")
    )
  };

  for (const required of signature.requiredEquipment) {
    maxScore += 10;
    if (equipmentPresent[required as keyof typeof equipmentPresent]) {
      score += 10;
    }
  }

  // Check instrumentation patterns
  for (const instrType of signature.typicalInstrumentation) {
    maxScore += 5;
    const hasInstr = categorized.instruments.some(i =>
      i.tagNumber?.startsWith(instrType)
    );
    if (hasInstr) {
      score += 5;
    }
  }

  // Bonus for exothermic reactor with cooling
  if (signature.processType.includes("Polymerization") ||
      signature.processType.includes("CSTR")) {
    const hasExothermicReactor = categorized.reactors.some(r =>
      r.engineering?.consequenceOfFailure?.toLowerCase().includes("runaway") ||
      r.engineering?.consequenceOfFailure?.toLowerCase().includes("exothermic")
    );
    const hasReactorCooling = categorized.heatExchangers.some(e =>
      e.name?.toLowerCase().includes("cooler") &&
      e.engineering?.processArea === "Reaction"
    );
    if (hasExothermicReactor && hasReactorCooling) {
      score += 15;
      maxScore += 15;
    }
  }

  // Check for recycle compressor (common in polymerization)
  if (signature.processType.includes("Polymerization")) {
    const hasRecycleCompressor = categorized.compressors.some(c =>
      c.name?.toLowerCase().includes("recycle")
    );
    if (hasRecycleCompressor) {
      score += 10;
      maxScore += 10;
    }
  }

  return maxScore > 0 ? (score / maxScore) * 100 : 0;
}

function reconstructProcessFlow(categorized: CategorizedAssets): ProcessFlowDiagram {
  const units: ProcessUnit[] = [];
  const streams: ProcessFlowDiagram["streams"] = [];
  const utilityConnections: ProcessFlowDiagram["utilityConnections"] = [];

  // Group assets by process area
  const areaEquipment = new Map<string, Partial<CanonAsset>[]>();

  for (const area of categorized.processAreas) {
    areaEquipment.set(area, []);
  }

  // Assign all Layer 1 & 2 equipment to areas
  const allEquipment = [
    ...categorized.reactors,
    ...categorized.columns,
    ...categorized.heatExchangers,
    ...categorized.vessels,
    ...categorized.pumps,
    ...categorized.compressors,
    ...categorized.tanks
  ];

  for (const eq of allEquipment) {
    const area = eq.engineering?.processArea || "Unknown";
    if (!areaEquipment.has(area)) {
      areaEquipment.set(area, []);
    }
    areaEquipment.get(area)!.push(eq);
  }

  // Create process units for each area
  let unitIndex = 1;
  for (const [area, equipment] of areaEquipment) {
    if (area === "Unknown" || equipment.length === 0) continue;

    // Get instruments for this area
    const areaInstruments = categorized.instruments.filter(i =>
      i.engineering?.processArea === area
    );

    // Identify control loops in this area
    const areaLoops = areaInstruments
      .filter(i => i.tagNumber?.match(/IC-|C-\d+$/))
      .map(i => i.tagNumber || "");

    // Identify safety functions in this area
    const areaSafety = categorized.safetyDevices
      .filter(s => s.engineering?.processArea === area)
      .map(s => s.tagNumber || "");

    const unit: ProcessUnit = {
      unitId: `UNIT-${unitIndex.toString().padStart(2, "0")}`,
      unitName: area,
      unitType: inferUnitType(area, equipment),
      feedStreams: [],
      productStreams: [],
      equipment: equipment.map(e => e.tagNumber || ""),
      instrumentation: areaInstruments.map(i => i.tagNumber || ""),
      controlLoops: areaLoops,
      safetyFunctions: areaSafety,
      upstreamUnits: [],
      downstreamUnits: []
    };

    units.push(unit);
    unitIndex++;
  }

  // Infer process flow connections based on typical plant layout
  // Reaction → Separation → Storage
  const reactionUnit = units.find(u => u.unitType === "Reaction");
  const separationUnit = units.find(u => u.unitType === "Separation");
  const storageUnit = units.find(u => u.unitType === "Storage");
  const utilitiesUnit = units.find(u => u.unitType === "Utilities");

  if (reactionUnit && separationUnit) {
    reactionUnit.downstreamUnits.push(separationUnit.unitId);
    separationUnit.upstreamUnits.push(reactionUnit.unitId);

    streams.push({
      streamId: "S-001",
      from: reactionUnit.unitId,
      to: separationUnit.unitId,
      phase: "two-phase",
      service: "Reactor Effluent"
    });
  }

  if (separationUnit && storageUnit) {
    separationUnit.downstreamUnits.push(storageUnit.unitId);
    storageUnit.upstreamUnits.push(separationUnit.unitId);

    streams.push({
      streamId: "S-002",
      from: separationUnit.unitId,
      to: storageUnit.unitId,
      phase: "liquid",
      service: "Product"
    });
  }

  // Add utility connections
  if (utilitiesUnit) {
    const steamConsumers = allEquipment
      .filter(e =>
        e.engineering?.shellSide?.includes("Steam") ||
        e.engineering?.heatingMedium?.includes("Steam")
      )
      .map(e => e.tagNumber || "");

    const cwConsumers = allEquipment
      .filter(e =>
        e.engineering?.shellSide?.includes("Cooling") ||
        e.engineering?.tubeSide?.includes("Cooling")
      )
      .map(e => e.tagNumber || "");

    if (steamConsumers.length > 0) {
      utilityConnections.push({
        utility: "Steam 150#",
        consumers: steamConsumers
      });
    }

    if (cwConsumers.length > 0) {
      utilityConnections.push({
        utility: "Cooling Water",
        consumers: cwConsumers
      });
    }
  }

  return { units, streams, utilityConnections };
}

function inferUnitType(area: string, equipment: Partial<CanonAsset>[]): string {
  const areaLower = area.toLowerCase();

  if (areaLower.includes("reaction") || areaLower.includes("reactor")) {
    return "Reaction";
  }
  if (areaLower.includes("separation") || areaLower.includes("distillation") ||
      areaLower.includes("fractionation")) {
    return "Separation";
  }
  if (areaLower.includes("storage") || areaLower.includes("tank")) {
    return "Storage";
  }
  if (areaLower.includes("utilit") || areaLower.includes("steam") ||
      areaLower.includes("cooling")) {
    return "Utilities";
  }
  if (areaLower.includes("relief") || areaLower.includes("flare")) {
    return "Relief Systems";
  }

  // Infer from equipment
  if (equipment.some(e => e.assetType === "reactor")) return "Reaction";
  if (equipment.some(e => e.assetType === "column")) return "Separation";
  if (equipment.some(e => e.assetType === "tank")) return "Storage";

  return "Unknown";
}

function identifyControlLoops(assets: Partial<CanonAsset>[]): ControlLoop[] {
  const loops: ControlLoop[] = [];

  // Find instruments that are controllers (tag ends in C or IC)
  const controllers = assets.filter(a =>
    a.layer === 2 &&
    a.tagNumber?.match(/(IC|C)-\d+$/)
  );

  for (const controller of controllers) {
    const tag = controller.tagNumber || "";
    const area = controller.engineering?.processArea || "";

    // Determine loop type from tag prefix
    let loopType: ControlLoop["loopType"] = "regulatory";
    let primaryVariable = "";
    let manipulatedVariable = "";
    let description = "";

    if (tag.startsWith("TIC")) {
      primaryVariable = "Temperature";
      manipulatedVariable = "Valve Position (heating/cooling)";
      description = `Temperature control loop for ${controller.engineering?.associatedEquipment || "equipment"}`;
    } else if (tag.startsWith("PIC")) {
      primaryVariable = "Pressure";
      manipulatedVariable = "Valve Position or Compressor Speed";
      description = `Pressure control loop for ${controller.engineering?.associatedEquipment || "equipment"}`;
    } else if (tag.startsWith("FIC")) {
      primaryVariable = "Flow";
      manipulatedVariable = "Control Valve Position";
      description = `Flow control loop for ${controller.engineering?.associatedEquipment || "stream"}`;
    } else if (tag.startsWith("LIC")) {
      primaryVariable = "Level";
      manipulatedVariable = "Outlet Valve Position";
      description = `Level control loop for ${controller.engineering?.associatedEquipment || "vessel"}`;
    } else if (tag.startsWith("AIC")) {
      primaryVariable = "Analysis (Composition)";
      manipulatedVariable = "Process Variable";
      loopType = "cascade";
      description = `Analyzer control loop with cascade to regulatory control`;
    }

    // Check for SIL rating indicating safety function
    if (controller.engineering?.silRating) {
      loopType = "safety";
    }

    // Determine criticality
    let criticalityRating: ControlLoop["criticalityRating"] = "medium";
    if (controller.security?.riskTier === "critical" || loopType === "safety") {
      criticalityRating = "safety_critical";
    } else if (controller.security?.riskTier === "high") {
      criticalityRating = "high";
    } else if (controller.security?.riskTier === "low") {
      criticalityRating = "low";
    }

    loops.push({
      loopId: tag,
      loopType,
      primaryVariable,
      manipulatedVariable,
      processArea: area,
      setpointSource: loopType === "safety" ? "safety" : "operator",
      criticalityRating,
      description
    });
  }

  return loops;
}

function mapSafetyFunctions(assets: Partial<CanonAsset>[]): SafetyFunction[] {
  const safetyFunctions: SafetyFunction[] = [];

  // Find SIS controllers
  const sisControllers = assets.filter(a =>
    a.assetType === "safety_controller"
  );

  // Find safety initiators (high-high trips, safety transmitters)
  const initiators = assets.filter(a =>
    a.tagNumber?.match(/^(TSHH|PSHH|LSHH|LAHH|LALL|PAHH|PALL)/) ||
    a.engineering?.silRating
  );

  // Find final elements (shutdown valves, blowdown valves)
  const finalElements = assets.filter(a =>
    a.assetType?.includes("shutdown") ||
    a.assetType?.includes("blowdown") ||
    a.tagNumber?.match(/^(SDV|BDV|XV)/)
  );

  // Group by process area and infer SIFs
  const sifMap = new Map<string, {
    initiators: Partial<CanonAsset>[];
    finalElements: Partial<CanonAsset>[];
    protectedEquipment: string;
  }>();

  for (const init of initiators) {
    const equipment = init.engineering?.associatedEquipment || "";
    if (!equipment) continue;

    if (!sifMap.has(equipment)) {
      sifMap.set(equipment, {
        initiators: [],
        finalElements: [],
        protectedEquipment: equipment
      });
    }
    sifMap.get(equipment)!.initiators.push(init);
  }

  for (const fe of finalElements) {
    const equipment = fe.engineering?.associatedEquipment || "";
    if (!equipment) continue;

    if (sifMap.has(equipment)) {
      sifMap.get(equipment)!.finalElements.push(fe);
    }
  }

  // Generate SIF records
  let sifIndex = 1;
  for (const [equipment, data] of sifMap) {
    // Infer hazard from initiator type
    let hazard = "Process upset";
    let description = `Safety function for ${equipment}`;

    const hasTemperature = data.initiators.some(i => i.tagNumber?.startsWith("TSHH"));
    const hasPressure = data.initiators.some(i => i.tagNumber?.startsWith("PSHH"));
    const hasLevel = data.initiators.some(i =>
      i.tagNumber?.startsWith("LSHH") || i.tagNumber?.startsWith("LAHH")
    );

    if (hasTemperature && equipment.startsWith("R-")) {
      hazard = "Thermal runaway / high temperature";
      description = "High temperature trip to prevent reactor runaway";
    } else if (hasPressure) {
      hazard = "Overpressure";
      description = "High pressure trip to prevent equipment failure";
    } else if (hasLevel) {
      hazard = "High/Low level";
      description = "Level trip to prevent overflow or pump damage";
    }

    // Get SIL rating from initiators
    const silRatings = data.initiators
      .filter(i => i.engineering?.silRating)
      .map(i => i.engineering!.silRating!);
    const silRating = silRatings.length > 0 ? silRatings[0] : "SIL1";

    // Find associated logic solver
    const logicSolver = sisControllers.find(s =>
      s.engineering?.processArea === data.initiators[0]?.engineering?.processArea
    )?.tagNumber || "Unknown SIS";

    safetyFunctions.push({
      sifId: `SIF-${sifIndex.toString().padStart(3, "0")}`,
      description,
      silRating,
      initiators: data.initiators.map(i => i.tagNumber || ""),
      logicSolver,
      finalElements: data.finalElements.map(fe => fe.tagNumber || ""),
      protectedEquipment: equipment,
      hazardMitigated: hazard,
      status: data.finalElements.length > 0 ? "complete" : "partial"
    });

    sifIndex++;
  }

  return safetyFunctions;
}

function identifyMissingAssets(
  categorized: CategorizedAssets,
  processType: ProcessSignature
): MissingAsset[] {
  const missing: MissingAsset[] = [];

  // Check for relief devices on pressure vessels
  const pressureVessels = [
    ...categorized.reactors,
    ...categorized.columns,
    ...categorized.vessels.filter(v =>
      v.engineering?.designPressure &&
      parseInt(v.engineering.designPressure) > 15
    )
  ];

  const reliefValves = categorized.safetyDevices.filter(d =>
    d.assetType === "relief_valve" || d.tagNumber?.startsWith("PSV")
  );

  for (const vessel of pressureVessels) {
    const hasRelief = reliefValves.some(rv =>
      rv.engineering?.associatedEquipment === vessel.tagNumber
    );

    if (!hasRelief) {
      missing.push({
        category: "Safety Device",
        expectedAsset: `PSV for ${vessel.tagNumber}`,
        reason: `Pressure vessel ${vessel.tagNumber} (${vessel.engineering?.designPressure}) requires relief protection per API 520/521`,
        severity: "critical",
        osintSource: "API 520/521, ASME VIII"
      });
    }
  }

  // Check for redundancy on critical pumps
  const criticalPumps = categorized.pumps.filter(p =>
    p.security?.riskTier === "critical" || p.security?.riskTier === "high"
  );

  for (const pump of criticalPumps) {
    const tag = pump.tagNumber || "";
    // Check if it's an A/B pair
    if (tag.match(/[AB]$/)) {
      const baseTag = tag.slice(0, -1);
      const hasPair = categorized.pumps.some(p =>
        p.tagNumber?.startsWith(baseTag) && p.tagNumber !== tag
      );
      if (!hasPair) {
        missing.push({
          category: "Redundancy",
          expectedAsset: `${baseTag}B (spare pump)`,
          reason: `Critical pump ${tag} should have redundant spare per process reliability requirements`,
          severity: "warning",
          osintSource: "Industry best practice, API 610"
        });
      }
    }
  }

  // Check for emergency shutdown capability
  const hasFig = categorized.controllers.some(c =>
    c.name?.toLowerCase().includes("fire") ||
    c.name?.toLowerCase().includes("gas") ||
    c.tagNumber?.includes("F&G")
  );

  if (!hasFig) {
    missing.push({
      category: "Safety System",
      expectedAsset: "Fire & Gas Detection System",
      reason: "Process facility should have fire and gas detection per NFPA 72, IEC 61511",
      severity: "critical",
      osintSource: "NFPA 72, IEC 61511, API RP 14C"
    });
  }

  // Check for emergency depressuring
  const hasDepressuring = categorized.safetyDevices.some(d =>
    d.assetType === "blowdown_valve" || d.tagNumber?.startsWith("BDV")
  );

  if (!hasDepressuring && categorized.reactors.length > 0) {
    missing.push({
      category: "Safety Device",
      expectedAsset: "Emergency Depressuring System",
      reason: "High pressure reactor systems require emergency depressuring per API 521",
      severity: "critical",
      osintSource: "API 521, IEC 61511"
    });
  }

  // Check for network segmentation
  const hasOtFirewall = categorized.networkDevices.some(d =>
    d.assetType === "firewall" && d.network?.vlan && d.network.vlan < 50
  );

  if (!hasOtFirewall) {
    missing.push({
      category: "Network Security",
      expectedAsset: "OT Network Firewall",
      reason: "Control network should be segmented from operations network per IEC 62443",
      severity: "critical",
      osintSource: "IEC 62443, NIST 800-82"
    });
  }

  // Process-specific checks
  if (processType.processType.includes("Polymerization")) {
    // Check for catalyst feed system
    const hasCatalyst = categorized.instruments.some(i =>
      i.name?.toLowerCase().includes("catalyst")
    );

    if (!hasCatalyst) {
      missing.push({
        category: "Process Equipment",
        expectedAsset: "Catalyst Feed System",
        reason: "Polymerization reactors require catalyst feed system with precise metering",
        severity: "warning",
        osintSource: "Polymerization process engineering literature"
      });
    }
  }

  return missing;
}

function identifyAttackSurfaces(
  assets: Partial<CanonAsset>[],
  processFlow: ProcessFlowDiagram,
  safetyFunctions: SafetyFunction[]
): AttackSurface[] {
  const surfaces: AttackSurface[] = [];

  // VPN and remote access
  const vpnAssets = assets.filter(a =>
    a.assetType === "vpn_concentrator" ||
    a.network?.remoteAccessExposure?.toLowerCase().includes("vpn")
  );

  for (const vpn of vpnAssets) {
    surfaces.push({
      entryPoint: vpn.tagNumber || "VPN",
      assetId: vpn.id || "",
      attackVector: "Remote Access Compromise",
      potentialImpact: "Initial access to OT network, lateral movement capability",
      physicalConsequence: "Depends on downstream access - could reach safety systems",
      mitigations: [
        "Multi-factor authentication",
        "Jump server with session recording",
        "Network segmentation",
        "Endpoint detection on VPN servers"
      ]
    });
  }

  // Engineering workstations
  const ews = assets.filter(a => a.assetType === "engineering_workstation");

  for (const ws of ews) {
    surfaces.push({
      entryPoint: ws.tagNumber || "EWS",
      assetId: ws.id || "",
      attackVector: "Compromised Engineering Workstation",
      potentialImpact: "Ability to modify controller logic, bypass safety systems",
      physicalConsequence: "Logic manipulation could cause process upset, disable safety functions",
      mitigations: [
        "Application whitelisting",
        "USB device control",
        "Network monitoring for engineering protocols",
        "Change management procedures"
      ]
    });
  }

  // DCS controllers with CVEs
  const vulnerableControllers = assets.filter(a =>
    (a.assetType === "dcs_controller" || a.assetType === "plc") &&
    (a.security?.cveCount || 0) > 5
  );

  for (const ctrl of vulnerableControllers) {
    const controlledEquipment = assets
      .filter(a => a.engineering?.associatedEquipment === ctrl.tagNumber)
      .map(a => a.tagNumber);

    surfaces.push({
      entryPoint: ctrl.tagNumber || "Controller",
      assetId: ctrl.id || "",
      attackVector: `Exploit known vulnerabilities (${ctrl.security?.cveCount} CVEs)`,
      potentialImpact: `Control of ${ctrl.engineering?.processArea} area equipment`,
      physicalConsequence: `Manipulation of ${controlledEquipment.join(", ") || "process controls"}`,
      mitigations: [
        "Apply vendor patches",
        "Network segmentation",
        "Protocol-aware firewall rules",
        "Anomaly detection on controller traffic"
      ]
    });
  }

  // Safety system vectors
  const sisControllers = assets.filter(a => a.assetType === "safety_controller");

  for (const sis of sisControllers) {
    const relatedSifs = safetyFunctions.filter(sif =>
      sif.logicSolver === sis.tagNumber
    );

    surfaces.push({
      entryPoint: sis.tagNumber || "SIS",
      assetId: sis.id || "",
      attackVector: "Safety System Compromise (TRITON-style)",
      potentialImpact: `Disable ${relatedSifs.length} safety instrumented functions`,
      physicalConsequence: relatedSifs.map(sif => sif.hazardMitigated).join("; ") || "Loss of safety protection",
      mitigations: [
        "Physical separation of SIS network",
        "Read-only SIS network connections where possible",
        "SIS-specific change management",
        "Regular SIS logic verification"
      ]
    });
  }

  return surfaces;
}

function calculateConfidence(
  categorized: CategorizedAssets,
  processType: ProcessSignature,
  controlLoops: ControlLoop[]
): number {
  let score = 0;

  // Base score from process type match
  score += processType.confidence * 0.3;

  // Score for control loop completeness
  const expectedLoops = categorized.reactors.length * 3 + // T, P, L per reactor
                        categorized.columns.length * 4 +   // T, P, L, F per column
                        categorized.vessels.length;        // L per vessel

  const loopCompleteness = Math.min(controlLoops.length / Math.max(expectedLoops, 1), 1);
  score += loopCompleteness * 30;

  // Score for safety function coverage
  const criticalEquipment = [
    ...categorized.reactors,
    ...categorized.compressors
  ].length;

  const safetyDeviceCoverage = Math.min(
    categorized.safetyDevices.length / Math.max(criticalEquipment * 2, 1),
    1
  );
  score += safetyDeviceCoverage * 20;

  // Score for network visibility
  const networkCoverage = categorized.networkDevices.length >= 5 ? 1 :
                          categorized.networkDevices.length / 5;
  score += networkCoverage * 20;

  return Math.round(score);
}

function generateNotes(
  categorized: CategorizedAssets,
  processType: ProcessSignature
): string[] {
  const notes: string[] = [];

  notes.push(`Process identified as ${processType.processType} (${processType.industryCategory}) with ${processType.confidence.toFixed(0)}% confidence`);

  notes.push(`Inventory contains ${categorized.reactors.length} reactors, ${categorized.columns.length} columns, ${categorized.compressors.length} compressors`);

  notes.push(`${categorized.controllers.length} controllers identified: ` +
    `${categorized.controllers.filter(c => c.assetType === "dcs_controller").length} DCS, ` +
    `${categorized.controllers.filter(c => c.assetType === "plc").length} PLC, ` +
    `${categorized.controllers.filter(c => c.assetType === "safety_controller").length} SIS`
  );

  notes.push(`${categorized.safetyDevices.length} safety devices mapped`);

  const totalCves = [...categorized.controllers, ...categorized.servers]
    .reduce((sum, a) => sum + (a.security?.cveCount || 0), 0);
  notes.push(`${totalCves} total CVEs identified across control and operations layers`);

  // OSINT insights
  for (const hazard of processType.hazards.slice(0, 2)) {
    notes.push(`Key hazard (OSINT): ${hazard}`);
  }

  return notes;
}

// ============================================================================
// EXPORT VISUALIZATION DATA
// ============================================================================
export interface PlantVisualization {
  processFlowSvgData: ProcessFlowSvgData;
  networkTopology: NetworkTopology;
  controlHierarchy: ControlHierarchy;
}

interface ProcessFlowSvgData {
  units: { id: string; name: string; type: string; x: number; y: number; }[];
  connections: { from: string; to: string; label: string; }[];
}

interface NetworkTopology {
  zones: { name: string; vlan: number; devices: string[]; }[];
  firewalls: { from: string; to: string; device: string; }[];
}

interface ControlHierarchy {
  layers: { level: number; name: string; assets: string[]; }[];
}

export function generateVisualizationData(
  reconstruction: PlantReconstruction
): PlantVisualization {
  // Generate process flow SVG positions
  const units = reconstruction.processFlow.units.map((unit, i) => ({
    id: unit.unitId,
    name: unit.unitName,
    type: unit.unitType,
    x: 100 + (i % 3) * 250,
    y: 100 + Math.floor(i / 3) * 200
  }));

  const connections = reconstruction.processFlow.streams.map(stream => ({
    from: stream.from,
    to: stream.to,
    label: stream.service
  }));

  return {
    processFlowSvgData: { units, connections },
    networkTopology: {
      zones: [
        { name: "Enterprise", vlan: 0, devices: [] },
        { name: "DMZ", vlan: 10, devices: [] },
        { name: "Operations", vlan: 50, devices: [] },
        { name: "Control", vlan: 40, devices: [] },
        { name: "Safety", vlan: 30, devices: [] },
        { name: "Field", vlan: 20, devices: [] }
      ],
      firewalls: []
    },
    controlHierarchy: {
      layers: [
        { level: 6, name: "Enterprise", assets: [] },
        { level: 5, name: "Network", assets: [] },
        { level: 4, name: "Operations", assets: [] },
        { level: 3, name: "Control", assets: [] },
        { level: 2, name: "Instrumentation", assets: [] },
        { level: 1, name: "Physical", assets: [] }
      ]
    }
  };
}
