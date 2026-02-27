"use client";

import { useState, useEffect } from "react";

interface EngineeringObservation {
  severity: "critical" | "major" | "minor" | "question";
  category: string;
  title: string;
  observation: string;
  engineeringRationale: string;
  suggestedAction: string;
  affectedArea: string;
  relatedAssets: string[];
}

interface EngineeringAnalysis {
  plantType: string;
  observations: EngineeringObservation[];
  processFlowQuestions: string[];
  materialBalanceGaps: string[];
  energyBalanceGaps: string[];
  controlPhilosophyIssues: string[];
  overallAssessment: string;
}

interface ProcessSignature {
  processType: string;
  industryCategory: string;
  description: string;
  hazards: string[];
  confidence: number;
}

interface ProcessUnit {
  unitId: string;
  unitName: string;
  unitType: string;
  equipment: string[];
  instrumentation: string[];
  controlLoops: string[];
  safetyFunctions: string[];
  upstreamUnits: string[];
  downstreamUnits: string[];
}

interface ControlLoop {
  loopId: string;
  loopType: string;
  primaryVariable: string;
  processArea: string;
  criticalityRating: string;
  description: string;
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
  status: string;
}

interface AttackSurface {
  entryPoint: string;
  attackVector: string;
  potentialImpact: string;
  physicalConsequence: string;
  mitigations: string[];
}

interface PlantReconstruction {
  inferredProcessType: ProcessSignature;
  processFlow: {
    units: ProcessUnit[];
    streams: { streamId: string; from: string; to: string; service: string }[];
    utilityConnections: { utility: string; consumers: string[] }[];
  };
  controlLoops: ControlLoop[];
  safetyFunctions: SafetyFunction[];
  missingAssets: { category: string; expectedAsset: string; reason: string; severity: string; osintSource: string }[];
  attackSurfaces: AttackSurface[];
  confidenceScore: number;
  reconstructionNotes: string[];
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
    badge: "bg-red-600 text-white",
    icon: "!",
  },
  major: {
    border: "border-orange-500",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    badge: "bg-orange-500 text-white",
    icon: "⚠",
  },
  minor: {
    border: "border-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    badge: "bg-yellow-500 text-black",
    icon: "○",
  },
  question: {
    border: "border-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    badge: "bg-blue-500 text-white",
    icon: "?",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  missing_unit: "Missing Unit Operation",
  missing_equipment: "Missing Equipment",
  control_gap: "Control Gap",
  safety_gap: "Safety Gap",
  process_logic: "Process Logic Issue",
  redundancy: "Redundancy Issue",
};

export default function PlantReconstructionPanel() {
  const [reconstruction, setReconstruction] = useState<PlantReconstruction | null>(null);
  const [engineering, setEngineering] = useState<EngineeringAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"engineering" | "process" | "control" | "safety" | "attack">("engineering");
  const [error, setError] = useState<string | null>(null);

  const handleReconstruct = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reconstruct");
      if (!response.ok) throw new Error("Failed to reconstruct");

      const data = await response.json();
      setReconstruction(data.reconstruction);
      setEngineering(data.engineeringAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconstruction failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleReconstruct();
  }, []);

  const criticalCount = engineering?.observations.filter(o => o.severity === "critical").length || 0;
  const majorCount = engineering?.observations.filter(o => o.severity === "major").length || 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Plant Reconstruction (Engineering Analysis)
            </h3>
            <p className="text-sm text-gray-500">
              Process engineering common sense applied to asset inventory
            </p>
          </div>
          <button
            onClick={handleReconstruct}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-medium ${
              isLoading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700">Error: {error}</div>
      )}

      {engineering && reconstruction && (
        <>
          {/* Overall Assessment Banner */}
          <div className={`p-4 border-b ${
            criticalCount > 0
              ? "bg-red-100 dark:bg-red-900/30 border-red-200"
              : majorCount > 3
                ? "bg-orange-100 dark:bg-orange-900/30 border-orange-200"
                : "bg-green-100 dark:bg-green-900/30 border-green-200"
          }`}>
            <div className="flex items-start gap-3">
              <span className={`text-2xl ${
                criticalCount > 0 ? "text-red-600" : majorCount > 3 ? "text-orange-600" : "text-green-600"
              }`}>
                {criticalCount > 0 ? "⚠️" : majorCount > 3 ? "🔶" : "✅"}
              </span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {engineering.plantType}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {engineering.overallAssessment}
                </p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                <div className="text-xs text-gray-500">Critical Issues</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{majorCount}</div>
                <div className="text-xs text-gray-500">Major Issues</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {reconstruction.processFlow.units.length}
                </div>
                <div className="text-xs text-gray-500">Process Units</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {reconstruction.controlLoops.length}
                </div>
                <div className="text-xs text-gray-500">Control Loops</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {reconstruction.safetyFunctions.length}
                </div>
                <div className="text-xs text-gray-500">Safety Functions</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                  {reconstruction.confidenceScore}%
                </div>
                <div className="text-xs text-gray-500">Confidence</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex overflow-x-auto">
              {[
                { id: "engineering", label: "Engineering Issues", count: engineering.observations.length },
                { id: "process", label: "Process Flow" },
                { id: "control", label: "Control Loops" },
                { id: "safety", label: "Safety Functions" },
                { id: "attack", label: "Attack Surface" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {"count" in tab && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                      activeTab === tab.id ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Engineering Issues Tab - THE MAIN EVENT */}
            {activeTab === "engineering" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Engineering Common Sense Analysis
                  </h4>
                  <span className="text-sm text-gray-500">
                    "Can we actually run this plant with what we know?"
                  </span>
                </div>

                {/* Critical & Major Issues First */}
                {engineering.observations.length > 0 ? (
                  <div className="space-y-3">
                    {engineering.observations.map((obs, i) => {
                      const style = SEVERITY_STYLES[obs.severity];
                      return (
                        <div
                          key={i}
                          className={`border-l-4 ${style.border} ${style.bg} rounded-r-lg p-4`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                                  {obs.severity.toUpperCase()}
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                                  {CATEGORY_LABELS[obs.category] || obs.category}
                                </span>
                              </div>
                              <h5 className="font-semibold text-gray-900 dark:text-white text-lg">
                                {obs.title}
                              </h5>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                {obs.observation}
                              </p>
                            </div>
                            {obs.relatedAssets.length > 0 && (
                              <div className="text-right text-xs">
                                <div className="text-gray-500">Related:</div>
                                <div className="font-mono text-gray-600 dark:text-gray-400">
                                  {obs.relatedAssets.slice(0, 3).join(", ")}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2">
                              <div className="text-xs text-gray-500 mb-1">Why This Matters</div>
                              <div className="text-gray-700 dark:text-gray-300">
                                {obs.engineeringRationale}
                              </div>
                            </div>
                            <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2">
                              <div className="text-xs text-gray-500 mb-1">Suggested Action</div>
                              <div className="text-gray-700 dark:text-gray-300">
                                {obs.suggestedAction}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No significant engineering gaps identified
                  </div>
                )}

                {/* Questions & Gaps Summary */}
                {(engineering.processFlowQuestions.length > 0 ||
                  engineering.materialBalanceGaps.length > 0 ||
                  engineering.energyBalanceGaps.length > 0) && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {engineering.processFlowQuestions.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                          Process Flow Questions
                        </h5>
                        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                          {engineering.processFlowQuestions.map((q, i) => (
                            <li key={i}>• {q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {engineering.materialBalanceGaps.length > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                        <h5 className="font-medium text-orange-800 dark:text-orange-300 mb-2">
                          Material Balance Gaps
                        </h5>
                        <ul className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                          {engineering.materialBalanceGaps.map((g, i) => (
                            <li key={i}>• {g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {engineering.energyBalanceGaps.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                        <h5 className="font-medium text-red-800 dark:text-red-300 mb-2">
                          Energy Balance Gaps
                        </h5>
                        <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                          {engineering.energyBalanceGaps.map((g, i) => (
                            <li key={i}>• {g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Process Flow Tab */}
            {activeTab === "process" && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Reconstructed Process Flow
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reconstruction.processFlow.units.map((unit) => (
                    <div
                      key={unit.unitId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {unit.unitId}
                        </span>
                        <span className="text-xs text-gray-500">{unit.unitType}</span>
                      </div>
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        {unit.unitName}
                      </h5>
                      <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-1">
                        <div>{unit.equipment.length} equipment</div>
                        <div>{unit.instrumentation.length} instruments</div>
                        <div>{unit.controlLoops.length} loops</div>
                        <div>{unit.safetyFunctions.length} SIFs</div>
                      </div>
                    </div>
                  ))}
                </div>

                {reconstruction.processFlow.utilityConnections.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                      Utility Connections
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {reconstruction.processFlow.utilityConnections.map((conn, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                        >
                          {conn.utility} → {conn.consumers.length} consumers
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Control Loops Tab */}
            {activeTab === "control" && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Control Loops Identified
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <th className="px-3 py-2 text-left">Loop</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Variable</th>
                        <th className="px-3 py-2 text-left">Area</th>
                        <th className="px-3 py-2 text-left">Criticality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconstruction.controlLoops.map((loop) => (
                        <tr key={loop.loopId} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="px-3 py-2 font-mono">{loop.loopId}</td>
                          <td className="px-3 py-2">{loop.loopType}</td>
                          <td className="px-3 py-2">{loop.primaryVariable}</td>
                          <td className="px-3 py-2">{loop.processArea}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              loop.criticalityRating === "safety_critical" ? "bg-red-600 text-white" :
                              loop.criticalityRating === "high" ? "bg-orange-500 text-white" :
                              "bg-gray-200 text-gray-700"
                            }`}>
                              {loop.criticalityRating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Safety Functions Tab */}
            {activeTab === "safety" && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Safety Instrumented Functions
                </h4>
                <div className="space-y-3">
                  {reconstruction.safetyFunctions.map((sif) => (
                    <div
                      key={sif.sifId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-bold">{sif.sifId}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          sif.silRating === "SIL3" ? "bg-red-700 text-white" :
                          sif.silRating === "SIL2" ? "bg-orange-600 text-white" :
                          "bg-yellow-500 text-black"
                        }`}>
                          {sif.silRating}
                        </span>
                        <span className="text-sm text-gray-500">
                          Protects: {sif.protectedEquipment}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {sif.description}
                      </p>
                      <div className="mt-2 text-sm text-red-600">
                        Hazard: {sif.hazardMitigated}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Initiators: </span>
                          <span className="font-mono">{sif.initiators.join(", ") || "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Logic: </span>
                          <span className="font-mono">{sif.logicSolver}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Final Elements: </span>
                          <span className="font-mono">{sif.finalElements.join(", ") || "—"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attack Surface Tab */}
            {activeTab === "attack" && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Attack Surface Analysis
                </h4>
                <div className="space-y-3">
                  {reconstruction.attackSurfaces.slice(0, 10).map((surface, i) => (
                    <div
                      key={i}
                      className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50/50 dark:bg-red-900/10"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-bold text-red-700 dark:text-red-400">
                          {surface.entryPoint}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {surface.attackVector}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-gray-500">Impact</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {surface.potentialImpact}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Physical Consequence</div>
                          <div className="text-red-700 dark:text-red-400">
                            {surface.physicalConsequence}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {surface.mitigations.map((m, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!isLoading && !reconstruction && !error && (
        <div className="p-8 text-center text-gray-500">
          Click "Analyze" to reconstruct the plant from asset inventory
        </div>
      )}
    </div>
  );
}
