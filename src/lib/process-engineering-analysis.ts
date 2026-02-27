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
  category: "missing_unit" | "missing_equipment" | "control_gap" | "safety_gap" | "process_logic" | "redundancy";
  title: string;
  observation: string;
  engineeringRationale: string;
  suggestedAction: string;
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
      category: "missing_unit",
      title: "No Feed Preparation Section",
      observation: "Reactors are present but there's no identifiable feed preparation area",
      engineeringRationale: "Every reaction system needs feed preparation - mixing, heating/cooling, purification. Raw materials don't just appear at reactor inlet conditions.",
      suggestedAction: "Identify or add feed preparation equipment: surge drums, feed heaters, mixers, filters",
      affectedArea: "Reaction",
      relatedAssets: byType.reactors.map(r => r.tagNumber || ""),
    });
    materialBalanceGaps.push("Feed source and preparation not documented");
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
      category: "missing_unit",
      title: "No Product Loading/Finishing",
      observation: "Product storage tanks exist but no loading rack or finishing equipment",
      engineeringRationale: "Product has to leave the plant somehow - truck loading, rail loading, pipeline, or pelletizing for polymer plants.",
      suggestedAction: "Document product disposition: loading arms, metering skids, or polymer finishing equipment",
      affectedArea: "Storage",
      relatedAssets: byType.tanks.map(t => t.tagNumber || ""),
    });
    processFlowQuestions.push("How does product leave the facility?");
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
      category: "missing_equipment",
      title: `Missing Reboilers: ${columnCount} columns but ${reboilers.length} reboilers`,
      observation: `Found ${columnCount} distillation columns but only ${reboilers.length} reboilers`,
      engineeringRationale: "Every distillation column needs a reboiler to provide vapor boilup. Without it, the column cannot separate.",
      suggestedAction: `Add ${columnCount - reboilers.length} reboiler(s) to the separation section`,
      affectedArea: "Separation",
      relatedAssets: byType.columns.map(c => c.tagNumber || ""),
    });
    energyBalanceGaps.push(`Separation section missing ${columnCount - reboilers.length} reboiler(s)`);
  }

  // Check for reflux drums (one per column typically)
  const refluxDrums = byType.vessels.filter(v =>
    v.name?.toLowerCase().includes("reflux") ||
    v.name?.toLowerCase().includes("accumulator")
  );

  if (columnCount > 0 && refluxDrums.length < columnCount) {
    observations.push({
      severity: "major",
      category: "missing_equipment",
      title: `Missing Reflux Drums: ${columnCount} columns but ${refluxDrums.length} reflux drums`,
      observation: `Found ${columnCount} columns but only ${refluxDrums.length} reflux drums`,
      engineeringRationale: "Reflux drums are needed to separate vapor/liquid from condenser and provide surge capacity for reflux pump.",
      suggestedAction: "Add reflux drums or verify columns are using partial condensers",
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
        title: `Critical Pump Without Spare: ${tag}`,
        observation: `${pump.name} (${tag}) appears to be a single pump on critical service`,
        engineeringRationale: "Critical pumps should have installed spares (A/B configuration) to avoid unit shutdown on pump failure.",
        suggestedAction: `Add ${baseTag}B as installed spare`,
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
        title: `Compressor ${tag} Missing Anti-Surge Control`,
        observation: `No anti-surge controller found for compressor ${tag}`,
        engineeringRationale: "Centrifugal compressors will surge if operating point moves left of surge line. Surge causes mechanical damage and can destroy the machine.",
        suggestedAction: "Add anti-surge controller (ASC) with recycle valve",
        affectedArea: area,
        relatedAssets: [tag],
      });
      controlPhilosophyIssues.push(`Compressor ${tag} needs anti-surge protection`);
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
        category: "missing_equipment",
        title: `Compressor ${tag} Missing Suction KO Drum`,
        observation: `No suction knockout drum found upstream of ${tag}`,
        engineeringRationale: "Liquid carryover into a compressor causes severe damage. KO drums remove entrained liquid.",
        suggestedAction: "Add suction knockout drum with level control and high-level trip",
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
          title: `Exothermic Reactor ${tag} - No Emergency Cooling`,
          observation: `Reactor ${tag} has normal cooling but no apparent emergency cooling system`,
          engineeringRationale: "Exothermic reactors should have emergency cooling (quench, dump, or backup CW) independent of normal cooling in case of runaway.",
          suggestedAction: "Add emergency quench system or backup cooling water supply",
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
        title: `Reactor ${tag} - No Composition Analyzer`,
        observation: `No analyzer found for reactor ${tag} effluent`,
        engineeringRationale: "Exothermic reactors benefit from effluent analysis to detect conversion changes before temperature excursions.",
        suggestedAction: "Add online GC or other composition analyzer on reactor effluent",
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
          category: "missing_unit",
          title: `Missing ${req.system}`,
          observation: `No ${req.system.toLowerCase()} system identified in inventory`,
          engineeringRationale: req.description,
          suggestedAction: `Add ${req.system.toLowerCase()} equipment or verify it exists under different naming`,
          affectedArea: "Process",
          relatedAssets: [],
        });

        if (req.system === "Recycle System") {
          materialBalanceGaps.push("Unreacted monomer disposition not documented");
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
        title: `Vessel ${tag} Missing Level Indication`,
        observation: `No level transmitter/controller found for ${tag}`,
        engineeringRationale: "Every vessel with liquid inventory needs level measurement for safe operation.",
        suggestedAction: `Add LT/LIC for ${tag}`,
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
      category: "missing_unit",
      title: "No Flare System",
      observation: "No flare stack or thermal oxidizer identified",
      engineeringRationale: "Plants with pressure relief devices need a safe disposal system for relief gases. Venting to atmosphere is generally not permitted.",
      suggestedAction: "Add flare system or verify reliefs vent to scrubber/thermal oxidizer",
      affectedArea: "Relief Systems",
      relatedAssets: [],
    });
  } else if (!hasKoDrum) {
    observations.push({
      severity: "major",
      category: "missing_equipment",
      title: "No Flare Knockout Drum",
      observation: "Flare exists but no knockout drum found",
      engineeringRationale: "Flare KO drums remove liquid from relief streams before the flare tip. Liquid in flare causes smoking, burning rain, and tip damage.",
      suggestedAction: "Add flare knockout drum with level control and high-level alarm",
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
      title: "Insufficient Cooling Water Pump Redundancy",
      observation: `${cwConsumers.length} cooling water consumers but only ${cwPumps.length} CW pump(s)`,
      engineeringRationale: "Loss of cooling water can cause multiple process upsets simultaneously. Redundant pumps are essential.",
      suggestedAction: "Add redundant cooling water pumps (typically N+1 or 2x100%)",
      affectedArea: "Utilities",
      relatedAssets: cwPumps.map(p => p.tagNumber || ""),
    });
    energyBalanceGaps.push("Cooling water supply redundancy questionable");
  }

  // ============================================================================
  // GENERATE OVERALL ASSESSMENT
  // ============================================================================

  const criticalCount = observations.filter(o => o.severity === "critical").length;
  const majorCount = observations.filter(o => o.severity === "major").length;

  let overallAssessment = "";
  if (criticalCount > 0) {
    overallAssessment = `SIGNIFICANT GAPS: ${criticalCount} critical and ${majorCount} major issues identified. ` +
      "This inventory is missing fundamental unit operations or safety systems that would be required to operate. " +
      "Either equipment exists but isn't documented, or the inventory is substantially incomplete.";
  } else if (majorCount > 3) {
    overallAssessment = `INCOMPLETE: ${majorCount} major gaps identified. ` +
      "The core process is represented but supporting systems appear missing. " +
      "Recommend focused data collection on feed preparation, product finishing, and redundancy.";
  } else if (majorCount > 0) {
    overallAssessment = `REASONABLE: ${majorCount} gaps to address. ` +
      "The major unit operations appear present. Some equipment redundancy and auxiliary systems need verification.";
  } else {
    overallAssessment = "GOOD COVERAGE: No critical gaps identified in this analysis. " +
      "Major unit operations and control systems appear adequately represented.";
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
