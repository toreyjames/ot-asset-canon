/**
 * Process Engineering Analysis
 *
 * This module applies "engineering common sense" to identify:
 * - Missing unit operations in the process flow
 * - Equipment that should exist but doesn't
 * - Control loops that are incomplete
 * - Process flows that don't make sense
 *
 * Thinks like a process engineer walking through the plant asking
 * "wait, where does the feed come from?" or "how do you ship product?"
 */

import type { CanonAsset } from "@/types/canon";

// ============================================================================
// PROCESS ENGINEERING CHECKS
// ============================================================================

export interface EngineeringObservation {
  severity: "critical" | "major" | "minor" | "question";
  category: "undocumented_unit" | "undocumented_equipment" | "control_gap" | "safety_gap" | "data_gap" | "redundancy";
  title: string;
  observation: string;
  engineeringRationale: string;
  dataToCollect: string;
  affectedArea: string;
  relatedAssets: string[];
}

export interface ProcessEngineeringAnalysis {
  plantType: string;
  observations: EngineeringObservation[];
  processFlowQuestions: string[];
  materialBalanceGaps: string[];
  energyBalanceGaps: string[];
  controlPhilosophyIssues: string[];
  overallAssessment: string;
}

// ============================================================================
// UNIT OPERATION TEMPLATES
// What equipment/instrumentation is typically required for each unit op?
// ============================================================================

interface UnitOperationTemplate {
  name: string;
  requiredEquipment: { type: string; minCount: number; description: string }[];
  requiredInstrumentation: { pattern: string; description: string }[];
  typicalUpstream: string[];
  typicalDownstream: string[];
  criticalControlLoops: string[];
}

const UNIT_OPERATION_TEMPLATES: Record<string, UnitOperationTemplate> = {
  reaction: {
    name: "Reaction Section",
    requiredEquipment: [
      { type: "reactor", minCount: 1, description: "Primary reactor vessel" },
      { type: "heat_exchanger", minCount: 2, description: "Feed preheater + effluent cooler" },
      { type: "pump", minCount: 1, description: "Feed/transfer pump" },
    ],
    requiredInstrumentation: [
      { pattern: "TIC", description: "Temperature control" },
      { pattern: "PIC", description: "Pressure control" },
      { pattern: "FIC", description: "Feed flow control" },
      { pattern: "LIC", description: "Level control" },
    ],
    typicalUpstream: ["feed_preparation", "raw_material_storage"],
    typicalDownstream: ["separation", "quench"],
    criticalControlLoops: ["Reactor temperature", "Reactor pressure", "Feed ratio"],
  },

  separation: {
    name: "Separation/Distillation",
    requiredEquipment: [
      { type: "column", minCount: 1, description: "Distillation column" },
      { type: "heat_exchanger", minCount: 2, description: "Condenser + reboiler per column" },
      { type: "vessel", minCount: 1, description: "Reflux drum" },
      { type: "pump", minCount: 2, description: "Reflux pump + bottoms pump" },
    ],
    requiredInstrumentation: [
      { pattern: "TIC", description: "Column temperature control" },
      { pattern: "PIC", description: "Column pressure control" },
      { pattern: "LIC", description: "Reflux drum & column bottom level" },
      { pattern: "FIC", description: "Reflux flow control" },
      { pattern: "PDT", description: "Column differential pressure (flooding)" },
    ],
    typicalUpstream: ["reaction", "flash"],
    typicalDownstream: ["product_storage", "purification"],
    criticalControlLoops: ["Column pressure", "Reflux ratio", "Reboiler duty"],
  },

  storage: {
    name: "Storage & Loading",
    requiredEquipment: [
      { type: "tank", minCount: 2, description: "Product storage tanks (for swing operation)" },
      { type: "pump", minCount: 1, description: "Transfer/loading pump" },
    ],
    requiredInstrumentation: [
      { pattern: "LT", description: "Tank level indication" },
      { pattern: "LSHH", description: "High-high level alarm/trip" },
    ],
    typicalUpstream: ["separation", "purification"],
    typicalDownstream: ["loading_rack", "pipeline"],
    criticalControlLoops: ["Tank level", "Transfer flow"],
  },

  utilities: {
    name: "Utilities",
    requiredEquipment: [
      { type: "cooling_tower", minCount: 1, description: "Cooling water supply" },
      { type: "boiler", minCount: 1, description: "Steam generation" },
      { type: "pump", minCount: 2, description: "CW pumps (with spare)" },
    ],
    requiredInstrumentation: [
      { pattern: "FT-4", description: "Cooling water flow" },
      { pattern: "PT-4", description: "Steam header pressure" },
      { pattern: "TT-4", description: "CW temperature" },
    ],
    typicalUpstream: [],
    typicalDownstream: [],
    criticalControlLoops: ["Steam pressure", "CW supply pressure"],
  },

  feed_preparation: {
    name: "Feed Preparation",
    requiredEquipment: [
      { type: "vessel", minCount: 1, description: "Feed surge/mixing drum" },
      { type: "pump", minCount: 1, description: "Feed pump" },
      { type: "heat_exchanger", minCount: 1, description: "Feed preheater or cooler" },
    ],
    requiredInstrumentation: [
      { pattern: "FIC", description: "Feed flow control" },
      { pattern: "LIC", description: "Feed drum level" },
      { pattern: "AT", description: "Feed quality analyzer" },
    ],
    typicalUpstream: ["raw_material_storage", "offsite"],
    typicalDownstream: ["reaction"],
    criticalControlLoops: ["Feed flow", "Feed composition"],
  },

  compression: {
    name: "Compression",
    requiredEquipment: [
      { type: "compressor", minCount: 1, description: "Process gas compressor" },
      { type: "vessel", minCount: 1, description: "Suction knockout drum" },
      { type: "heat_exchanger", minCount: 1, description: "Interstage/aftercooler" },
    ],
    requiredInstrumentation: [
      { pattern: "PIC", description: "Discharge pressure control" },
      { pattern: "FIC", description: "Flow/anti-surge control" },
      { pattern: "VT", description: "Vibration monitoring" },
      { pattern: "TT", description: "Discharge temperature" },
    ],
    typicalUpstream: ["reaction", "separation"],
    typicalDownstream: ["reaction", "storage"],
    criticalControlLoops: ["Anti-surge", "Discharge pressure"],
  },

  flare: {
    name: "Flare/Relief System",
    requiredEquipment: [
      { type: "flare", minCount: 1, description: "Flare stack or thermal oxidizer" },
      { type: "vessel", minCount: 1, description: "Flare knockout drum" },
    ],
    requiredInstrumentation: [
      { pattern: "PT", description: "Flare header pressure" },
      { pattern: "FT", description: "Flare flow (optional)" },
      { pattern: "LT", description: "KO drum level" },
    ],
    typicalUpstream: [],
    typicalDownstream: [],
    criticalControlLoops: ["KO drum level"],
  },
};

// ============================================================================
// POLYMERIZATION-SPECIFIC CHECKS
// ============================================================================

const POLYMERIZATION_REQUIREMENTS = {
  criticalSystems: [
    {
      system: "Catalyst Feed",
      indicators: ["catalyst", "initiator", "cocatalyst"],
      description: "Polymerization requires precise catalyst metering",
      consequence: "No reaction control, off-spec product, potential runaway",
    },
    {
      system: "Monomer Purification",
      indicators: ["purification", "dryer", "treater", "guard bed"],
      description: "Monomer must be purified to protect catalyst",
      consequence: "Catalyst poisoning, poor conversion, wasted catalyst",
    },
    {
      system: "Polymer Degassing",
      indicators: ["degasser", "stripper", "flash drum"],
      description: "Unreacted monomer must be removed from product",
      consequence: "Safety hazard, product quality issues",
    },
    {
      system: "Pelletizing/Finishing",
      indicators: ["pelletizer", "extruder", "cutter", "dryer"],
      description: "Polymer must be converted to pellet form",
      consequence: "Cannot ship product in usable form",
    },
    {
      system: "Recycle System",
      indicators: ["recycle", "recovery"],
      description: "Unreacted monomer must be recovered and recycled",
      consequence: "Yield loss, increased raw material cost",
    },
  ],
};

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export function analyzeProcessEngineering(assets: Partial<CanonAsset>[]): ProcessEngineeringAnalysis {
  const observations: EngineeringObservation[] = [];
  const processFlowQuestions: string[] = [];
  const materialBalanceGaps: string[] = [];
  const energyBalanceGaps: string[] = [];
  const controlPhilosophyIssues: string[] = [];

  // Categorize assets
  const byType = categorizeByType(assets);
  const byArea = categorizeByArea(assets);
  const processAreas = [...new Set(assets.map(a => a.engineering?.processArea).filter(Boolean))] as string[];

  // Infer plant type
  const plantType = inferPlantType(byType);

  // ============================================================================
  // CHECK 1: Missing Unit Operations
  // ============================================================================

  // Does this plant have feed preparation?
  const hasFeedPrep = assets.some(a =>
    a.engineering?.processArea?.toLowerCase().includes("feed") ||
    a.name?.toLowerCase().includes("feed prep") ||
    a.name?.toLowerCase().includes("feed treatment")
  );

  if (!hasFeedPrep && byType.reactors.length > 0) {
    observations.push({
      severity: "major",
      category: "undocumented_unit",
      title: "Feed Preparation Section Not in Inventory",
      observation: "Reactors are documented but feed preparation equipment isn't in the asset list",
      engineeringRationale: "Every reaction system has feed preparation - surge drums, heaters, mixers, filters. This equipment exists but isn't captured in our data.",
      dataToCollect: "Document feed preparation equipment: surge drums, feed heaters/coolers, mixers, filters, feed pumps",
      affectedArea: "Reaction",
      relatedAssets: byType.reactors.map(r => r.tagNumber || ""),
    });
    materialBalanceGaps.push("Feed preparation equipment not documented");
  }

  // Does this plant have product finishing/loading?
  const hasProductFinishing = assets.some(a =>
    a.name?.toLowerCase().includes("loading") ||
    a.name?.toLowerCase().includes("pelletiz") ||
    a.name?.toLowerCase().includes("packag") ||
    a.name?.toLowerCase().includes("shipping") ||
    a.name?.toLowerCase().includes("truck") ||
    a.name?.toLowerCase().includes("rail")
  );

  if (!hasProductFinishing && byType.tanks.length > 0) {
    observations.push({
      severity: "major",
      category: "undocumented_unit",
      title: "Product Loading/Finishing Not in Inventory",
      observation: "Product storage tanks are documented but loading/finishing equipment isn't in the asset list",
      engineeringRationale: "Product leaves the plant somehow - truck loading, rail, pipeline, or pelletizing. This equipment exists but isn't captured.",
      dataToCollect: "Document product disposition equipment: loading arms, metering skids, truck/rail scales, or polymer finishing (extruder, pelletizer)",
      affectedArea: "Storage",
      relatedAssets: byType.tanks.map(t => t.tagNumber || ""),
    });
    processFlowQuestions.push("Product loading/shipping equipment not documented");
  }

  // ============================================================================
  // CHECK 2: Equipment Balance (Engineering Sense)
  // ============================================================================

  // Columns should have reboilers AND condensers
  const columnCount = byType.columns.length;
  const reactionHeatExchangers = byType.heatExchangers.filter(e =>
    e.engineering?.processArea === "Separation"
  );
  const reboilers = reactionHeatExchangers.filter(e =>
    e.name?.toLowerCase().includes("reboil") ||
    e.engineering?.heatingMedium
  );
  const condensers = reactionHeatExchangers.filter(e =>
    e.name?.toLowerCase().includes("condens") ||
    (e.engineering?.shellSide?.toLowerCase().includes("cooling") &&
     e.engineering?.processArea === "Separation")
  );

  if (columnCount > 0 && reboilers.length < columnCount) {
    observations.push({
      severity: "critical",
      category: "undocumented_equipment",
      title: `Reboiler Data Gap: ${columnCount} columns but only ${reboilers.length} reboiler(s) documented`,
      observation: `${columnCount} distillation columns in inventory but only ${reboilers.length} reboiler(s) - the other ${columnCount - reboilers.length} reboiler(s) exist but aren't documented`,
      engineeringRationale: "Every distillation column has a reboiler. These heat exchangers exist in the plant but aren't in our asset list.",
      dataToCollect: `Document the ${columnCount - reboilers.length} undocumented reboiler(s): tag numbers, duty, steam/hot oil service, associated column`,
      affectedArea: "Separation",
      relatedAssets: byType.columns.map(c => c.tagNumber || ""),
    });
    energyBalanceGaps.push(`${columnCount - reboilers.length} reboiler(s) not documented`);
  }

  // Check for reflux drums (one per column typically)
  const refluxDrums = byType.vessels.filter(v =>
    v.name?.toLowerCase().includes("reflux") ||
    v.name?.toLowerCase().includes("accumulator")
  );

  if (columnCount > 0 && refluxDrums.length < columnCount) {
    observations.push({
      severity: "major",
      category: "undocumented_equipment",
      title: `Reflux Drum Data Gap: ${columnCount} columns but only ${refluxDrums.length} reflux drum(s) documented`,
      observation: `${columnCount} columns documented but only ${refluxDrums.length} reflux drum(s) in inventory`,
      engineeringRationale: "Reflux drums/accumulators exist for each column. These vessels are in the plant but not captured in our data.",
      dataToCollect: `Document reflux drums/accumulators for columns: tag numbers, volumes, associated column and condenser`,
      affectedArea: "Separation",
      relatedAssets: byType.columns.map(c => c.tagNumber || ""),
    });
  }

  // ============================================================================
  // CHECK 3: Pump Redundancy on Critical Services
  // ============================================================================

  // Find pumps without A/B pairs
  const pumpTags = byType.pumps.map(p => p.tagNumber || "");
  const pumpBases = new Set<string>();
  const sparePumps = new Set<string>();

  for (const tag of pumpTags) {
    // P-101A -> base is P-101
    const match = tag.match(/^(P-\d+)([AB])?$/);
    if (match) {
      pumpBases.add(match[1]);
      if (match[2]) {
        sparePumps.add(match[1]);
      }
    }
  }

  // Check critical pumps without spares
  const criticalPumpServices = ["feed", "reactor", "reflux", "bottoms", "cooling water"];
  for (const pump of byType.pumps) {
    const name = pump.name?.toLowerCase() || "";
    const tag = pump.tagNumber || "";
    const baseTag = tag.replace(/[AB]$/, "");

    const isCritical = criticalPumpServices.some(s => name.includes(s));
    const hasSpare = sparePumps.has(baseTag) || tag.endsWith("B");

    if (isCritical && !hasSpare && !tag.endsWith("B")) {
      observations.push({
        severity: "major",
        category: "redundancy",
        title: `Spare Pump Not Documented: ${tag}`,
        observation: `${pump.name} (${tag}) shows as single pump - spare likely exists but isn't in inventory`,
        engineeringRationale: "Critical pumps typically have installed spares (A/B configuration). The spare pump likely exists but isn't documented.",
        dataToCollect: `Verify and document spare pump: ${baseTag}B tag, motor size, current status (installed spare vs warehouse)`,
        affectedArea: pump.engineering?.processArea || "Unknown",
        relatedAssets: [tag],
      });
    }
  }

  // ============================================================================
  // CHECK 4: Compressor System Completeness
  // ============================================================================

  for (const compressor of byType.compressors) {
    const tag = compressor.tagNumber || "";
    const area = compressor.engineering?.processArea || "";

    // Check for anti-surge control
    const hasAntiSurge = assets.some(a =>
      a.tagNumber?.includes("ASC") ||
      (a.name?.toLowerCase().includes("surge") && a.engineering?.associatedEquipment === tag)
    );

    if (!hasAntiSurge) {
      observations.push({
        severity: "critical",
        category: "control_gap",
        title: `Compressor ${tag} Anti-Surge Control Not Documented`,
        observation: `No anti-surge controller found in inventory for compressor ${tag}`,
        engineeringRationale: "Centrifugal compressors have anti-surge protection - this control system exists but isn't in our asset list.",
        dataToCollect: `Document anti-surge system for ${tag}: ASC controller tag, recycle valve tag, surge detection instruments`,
        affectedArea: area,
        relatedAssets: [tag],
      });
      controlPhilosophyIssues.push(`Compressor ${tag} anti-surge system not documented`);
    }

    // Check for suction KO drum
    const hasKoDrum = byType.vessels.some(v =>
      v.name?.toLowerCase().includes("knockout") ||
      v.name?.toLowerCase().includes("suction drum") ||
      v.name?.toLowerCase().includes("ko drum")
    );

    if (!hasKoDrum) {
      observations.push({
        severity: "major",
        category: "undocumented_equipment",
        title: `Compressor ${tag} Suction KO Drum Not Documented`,
        observation: `No suction knockout drum found in inventory for ${tag}`,
        engineeringRationale: "Compressors have suction KO drums to prevent liquid carryover. This vessel exists but isn't documented.",
        dataToCollect: `Document suction KO drum for ${tag}: vessel tag, volume, level instruments, high-level trip`,
        affectedArea: area,
        relatedAssets: [tag],
      });
    }
  }

  // ============================================================================
  // CHECK 5: Reactor System Completeness
  // ============================================================================

  for (const reactor of byType.reactors) {
    const tag = reactor.tagNumber || "";
    const area = reactor.engineering?.processArea || "";
    const isExothermic = reactor.engineering?.consequenceOfFailure?.toLowerCase().includes("runaway") ||
                         reactor.engineering?.consequenceOfFailure?.toLowerCase().includes("exothermic");

    // Exothermic reactors need emergency cooling
    if (isExothermic) {
      const hasCooling = byType.heatExchangers.some(e =>
        e.engineering?.processArea === area &&
        (e.name?.toLowerCase().includes("cool") ||
         e.engineering?.shellSide?.toLowerCase().includes("cooling"))
      );

      const hasEmergencyCooling = assets.some(a =>
        a.name?.toLowerCase().includes("emergency") &&
        a.name?.toLowerCase().includes("cool")
      );

      if (hasCooling && !hasEmergencyCooling) {
        observations.push({
          severity: "major",
          category: "safety_gap",
          title: `Exothermic Reactor ${tag} - Emergency Cooling Not Documented`,
          observation: `Reactor ${tag} normal cooling is documented but emergency cooling system isn't in inventory`,
          engineeringRationale: "Exothermic reactors have emergency cooling (quench, dump, or backup CW). This safety system exists but isn't captured.",
          dataToCollect: `Document emergency cooling for ${tag}: quench system, emergency CW valves, dump system, associated SIF`,
          affectedArea: area,
          relatedAssets: [tag],
        });
      }
    }

    // Check for reaction monitoring
    const hasAnalyzer = assets.some(a =>
      a.assetType === "analyzer" &&
      (a.engineering?.processArea === area ||
       a.engineering?.associatedEquipment === tag)
    );

    if (!hasAnalyzer && isExothermic) {
      observations.push({
        severity: "minor",
        category: "control_gap",
        title: `Reactor ${tag} - Composition Analyzer Not Documented`,
        observation: `No analyzer documented for reactor ${tag} effluent`,
        engineeringRationale: "Exothermic reactors typically have effluent analyzers. If one exists, it should be documented.",
        dataToCollect: `Verify and document any analyzer on ${tag} effluent: GC, NIR, or other composition measurement`,
        affectedArea: area,
        relatedAssets: [tag],
      });
    }
  }

  // ============================================================================
  // CHECK 6: Polymerization-Specific Checks
  // ============================================================================

  if (plantType.includes("Polymerization")) {
    for (const req of POLYMERIZATION_REQUIREMENTS.criticalSystems) {
      const hasSystem = assets.some(a =>
        req.indicators.some(ind =>
          a.name?.toLowerCase().includes(ind) ||
          a.tagNumber?.toLowerCase().includes(ind)
        )
      );

      if (!hasSystem) {
        observations.push({
          severity: req.system === "Catalyst Feed" ? "critical" : "major",
          category: "undocumented_unit",
          title: `${req.system} Not Documented`,
          observation: `No ${req.system.toLowerCase()} equipment found in inventory - this system exists but isn't captured`,
          engineeringRationale: req.description + ". This equipment is in the plant but not in our asset list.",
          dataToCollect: `Document ${req.system.toLowerCase()} equipment: vessels, pumps, instruments, controllers`,
          affectedArea: "Process",
          relatedAssets: [],
        });

        if (req.system === "Recycle System") {
          materialBalanceGaps.push("Recycle system equipment not documented");
        }
      }
    }
  }

  // ============================================================================
  // CHECK 7: Control Loop Completeness
  // ============================================================================

  // Every vessel needs level control
  for (const vessel of [...byType.vessels, ...byType.tanks]) {
    const tag = vessel.tagNumber || "";
    const hasLevelControl = assets.some(a =>
      a.tagNumber?.match(/^L(IC|T)-/) &&
      (a.engineering?.associatedEquipment === tag ||
       a.tagNumber?.includes(tag.replace(/^V-|TK-/, "")))
    );

    if (!hasLevelControl && vessel.engineering?.volume) {
      observations.push({
        severity: "minor",
        category: "control_gap",
        title: `Vessel ${tag} Level Instrumentation Not Documented`,
        observation: `No level transmitter found in inventory for ${tag}`,
        engineeringRationale: "Vessels with liquid inventory have level measurement. This instrumentation exists but isn't linked in our data.",
        dataToCollect: `Document level instrumentation for ${tag}: LT tag, LIC if controlled, high/low alarms`,
        affectedArea: vessel.engineering?.processArea || "Unknown",
        relatedAssets: [tag],
      });
    }
  }

  // ============================================================================
  // CHECK 8: Relief System Adequacy
  // ============================================================================

  const hasFlare = assets.some(a => a.assetType === "flare");
  const hasKoDrum = byType.vessels.some(v =>
    v.name?.toLowerCase().includes("flare") &&
    v.name?.toLowerCase().includes("drum")
  );

  if (!hasFlare) {
    observations.push({
      severity: "critical",
      category: "undocumented_unit",
      title: "Flare/Relief System Not Documented",
      observation: "No flare stack or thermal oxidizer in inventory - relief disposal system exists but isn't captured",
      engineeringRationale: "Plants have flare or thermal oxidizer for relief disposal. This system exists but isn't in our asset list.",
      dataToCollect: "Document relief disposal system: flare stack, pilots, KO drum, relief headers, thermal oxidizer if applicable",
      affectedArea: "Relief Systems",
      relatedAssets: [],
    });
  } else if (!hasKoDrum) {
    observations.push({
      severity: "major",
      category: "undocumented_equipment",
      title: "Flare Knockout Drum Not Documented",
      observation: "Flare is documented but knockout drum isn't in inventory",
      engineeringRationale: "Flare systems have KO drums to remove liquid. This vessel exists but isn't documented.",
      dataToCollect: "Document flare KO drum: vessel tag, volume, level instruments, drain system",
      affectedArea: "Relief Systems",
      relatedAssets: [],
    });
  }

  // ============================================================================
  // CHECK 9: Cooling Water System
  // ============================================================================

  const cwConsumers = byType.heatExchangers.filter(e =>
    e.engineering?.shellSide?.toLowerCase().includes("cooling") ||
    e.engineering?.tubeSide?.toLowerCase().includes("cooling")
  );

  const cwPumps = byType.pumps.filter(p =>
    p.name?.toLowerCase().includes("cooling water")
  );

  if (cwConsumers.length > 5 && cwPumps.length < 2) {
    observations.push({
      severity: "major",
      category: "redundancy",
      title: "Cooling Water Pump Redundancy Not Documented",
      observation: `${cwConsumers.length} CW consumers documented but only ${cwPumps.length} CW pump(s) in inventory`,
      engineeringRationale: "Cooling water systems have redundant pumps (N+1). Additional pumps likely exist but aren't documented.",
      dataToCollect: "Document all cooling water pumps: operating and spare pumps, motor sizes, auto-start logic",
      affectedArea: "Utilities",
      relatedAssets: cwPumps.map(p => p.tagNumber || ""),
    });
    energyBalanceGaps.push("Cooling water pump redundancy not fully documented");
  }

  // ============================================================================
  // GENERATE OVERALL ASSESSMENT
  // ============================================================================

  const criticalCount = observations.filter(o => o.severity === "critical").length;
  const majorCount = observations.filter(o => o.severity === "major").length;

  let overallAssessment = "";
  if (criticalCount > 0) {
    overallAssessment = `DATA COLLECTION PRIORITY: ${criticalCount} critical and ${majorCount} major data gaps identified. ` +
      "Key unit operations and equipment exist in the plant but aren't captured in our inventory. " +
      "Focus data collection on the critical items first - these represent core process equipment.";
  } else if (majorCount > 3) {
    overallAssessment = `INVENTORY GAPS: ${majorCount} data gaps identified. ` +
      "Core process equipment is documented but supporting systems need data collection. " +
      "Recommend focused effort on feed preparation, product finishing, redundant equipment, and safety systems.";
  } else if (majorCount > 0) {
    overallAssessment = `GOOD PROGRESS: ${majorCount} minor gaps remaining. ` +
      "Major unit operations are well documented. Some equipment redundancy and auxiliary systems need verification.";
  } else {
    overallAssessment = "COMPREHENSIVE: No significant data gaps identified. " +
      "Major unit operations, control systems, and safety equipment appear well documented.";
  }

  return {
    plantType,
    observations: observations.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2, question: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    processFlowQuestions,
    materialBalanceGaps,
    energyBalanceGaps,
    controlPhilosophyIssues,
    overallAssessment,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface AssetsByType {
  reactors: Partial<CanonAsset>[];
  columns: Partial<CanonAsset>[];
  heatExchangers: Partial<CanonAsset>[];
  vessels: Partial<CanonAsset>[];
  pumps: Partial<CanonAsset>[];
  compressors: Partial<CanonAsset>[];
  tanks: Partial<CanonAsset>[];
  valves: Partial<CanonAsset>[];
  instruments: Partial<CanonAsset>[];
}

function categorizeByType(assets: Partial<CanonAsset>[]): AssetsByType {
  return {
    reactors: assets.filter(a => a.assetType === "reactor"),
    columns: assets.filter(a => a.assetType === "column"),
    heatExchangers: assets.filter(a => a.assetType === "heat_exchanger"),
    vessels: assets.filter(a => a.assetType === "vessel"),
    pumps: assets.filter(a => a.assetType === "pump"),
    compressors: assets.filter(a => a.assetType === "compressor"),
    tanks: assets.filter(a => a.assetType === "tank"),
    valves: assets.filter(a =>
      a.assetType?.includes("valve") ||
      a.tagNumber?.match(/^(FV|TV|LV|PV|SDV|BDV|XV)/)
    ),
    instruments: assets.filter(a => a.layer === 2),
  };
}

function categorizeByArea(assets: Partial<CanonAsset>[]): Map<string, Partial<CanonAsset>[]> {
  const byArea = new Map<string, Partial<CanonAsset>[]>();

  for (const asset of assets) {
    const area = asset.engineering?.processArea || "Unknown";
    if (!byArea.has(area)) {
      byArea.set(area, []);
    }
    byArea.get(area)!.push(asset);
  }

  return byArea;
}

function inferPlantType(byType: AssetsByType): string {
  // Simple inference based on equipment present
  const hasReactor = byType.reactors.length > 0;
  const hasColumn = byType.columns.length > 0;
  const hasCompressor = byType.compressors.length > 0;

  const isExothermic = byType.reactors.some(r =>
    r.engineering?.consequenceOfFailure?.toLowerCase().includes("runaway")
  );

  if (hasReactor && hasCompressor && isExothermic) {
    return "Olefin Polymerization / Polymer Plant";
  } else if (hasReactor && hasColumn) {
    return "Chemical Manufacturing";
  } else if (hasColumn && !hasReactor) {
    return "Separation / Fractionation";
  } else if (byType.tanks.length > 5) {
    return "Tank Farm / Terminal";
  }

  return "General Chemical Process";
}
