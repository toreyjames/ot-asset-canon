"use client";

import { useState, useMemo } from "react";
import ProcessMap from "@/components/canon/ProcessMap";
import RelationshipGraph from "@/components/canon/RelationshipGraph";
import VulnerabilityPanel from "@/components/canon/VulnerabilityPanel";
import PlantReconstructionPanel from "@/components/canon/PlantReconstruction";
import {
  checkInventoryCompleteness,
  analyzeGaps,
  type CompletenessResult,
  type PlantType,
} from "@/lib/inventory-completeness";
import { LAYER_NAMES, type CanonAsset, type CanonLayer } from "@/types/canon";
import { CHEMICAL_PLANT_ASSETS, ASSET_COUNTS } from "@/data/chemical-plant-assets";

const PLANT_TYPE_LABELS: Record<PlantType, string> = {
  chemical: "Chemical Plant",
  petrochemical: "Petrochemical Plant",
  refinery: "Oil Refinery",
  power_generation: "Power Generation",
  water_treatment: "Water Treatment",
  wastewater: "Wastewater Treatment",
  pharmaceutical: "Pharmaceutical",
  food_beverage: "Food & Beverage",
  pulp_paper: "Pulp & Paper",
  metals_mining: "Metals & Mining",
  oil_gas_upstream: "Oil & Gas (Upstream)",
  oil_gas_midstream: "Oil & Gas (Midstream)",
  manufacturing: "Manufacturing",
  unknown: "Unknown",
};

export default function InventoryPage() {
  const [showNetworkOverlay, setShowNetworkOverlay] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Partial<CanonAsset> | null>(null);

  // Calculate completeness
  const completeness = useMemo(
    () => checkInventoryCompleteness(CHEMICAL_PLANT_ASSETS),
    []
  );

  const gaps = useMemo(
    () => analyzeGaps(CHEMICAL_PLANT_ASSETS, completeness.inferredPlantType),
    [completeness.inferredPlantType]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Inventory Completeness
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Phase 1: Can we run this plant with what we know?
        </p>
      </div>

      {/* Completeness Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 col-span-1">
          <div className="text-center">
            <div
              className={`text-5xl font-bold ${
                completeness.canRunPlant
                  ? "text-green-600"
                  : completeness.overallScore >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {completeness.overallScore}%
            </div>
            <div className="text-sm text-gray-500 mt-1">Overall Completeness</div>
            <div
              className={`mt-2 px-3 py-1 rounded-full text-xs font-medium inline-block ${
                completeness.canRunPlant
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {completeness.canRunPlant ? "Can Run Plant" : "Cannot Run Plant"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Inferred Plant Type</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {PLANT_TYPE_LABELS[completeness.inferredPlantType]}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {completeness.plantTypeConfidence}% confidence
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-blue-500 rounded-full"
              style={{ width: `${completeness.plantTypeConfidence}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Control Loops</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-semibold text-green-600">
                {completeness.processUnderstanding.controlLoops.complete}
              </div>
              <div className="text-xs text-gray-500">Complete</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-yellow-600">
                {completeness.processUnderstanding.controlLoops.partial}
              </div>
              <div className="text-xs text-gray-500">Partial</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-red-600">
                {completeness.processUnderstanding.controlLoops.orphaned}
              </div>
              <div className="text-xs text-gray-500">Orphaned</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Process Areas</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {completeness.processUnderstanding.identifiedProcesses.length}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {completeness.processUnderstanding.identifiedProcesses.slice(0, 3).map((area) => (
              <span
                key={area}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Layer Scores */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Layer Completeness
        </h2>
        <div className="space-y-4">
          {completeness.layerScores.map((layer) => (
            <div key={layer.layer} className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-600 dark:text-gray-400">
                L{layer.layer}: {layer.name}
              </div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-4 rounded-full ${
                      layer.status === "complete"
                        ? "bg-green-500"
                        : layer.status === "partial"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${layer.score}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right text-sm font-medium">
                {layer.score}%
              </div>
              <div
                className={`w-20 text-center text-xs px-2 py-1 rounded ${
                  layer.status === "complete"
                    ? "bg-green-100 text-green-800"
                    : layer.status === "partial"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {layer.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Process Map */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Process Map
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showNetworkOverlay}
              onChange={(e) => setShowNetworkOverlay(e.target.checked)}
              className="rounded"
            />
            Show Network Connections
          </label>
        </div>
        <ProcessMap
          assets={CHEMICAL_PLANT_ASSETS}
          onAssetClick={setSelectedAsset}
          showNetworkOverlay={showNetworkOverlay}
        />
      </div>

      {/* Relationship Graph */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Inferred Relationships
        </h2>
        <RelationshipGraph
          assets={CHEMICAL_PLANT_ASSETS}
          selectedAssetId={selectedAsset?.id}
          onAssetSelect={setSelectedAsset}
        />
      </div>

      {/* Vulnerability Intelligence */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Vulnerability Intelligence
        </h2>
        <VulnerabilityPanel
          assets={CHEMICAL_PLANT_ASSETS}
          onAssetSelect={setSelectedAsset}
        />
      </div>

      {/* Plant Reconstruction */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Plant Reconstruction (OSINT + Data Analysis)
        </h2>
        <PlantReconstructionPanel />
      </div>

      {/* Gaps & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Gaps */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Gaps Identified
          </h2>
          {completeness.layerScores.some((l) => l.gaps.length > 0) ? (
            <div className="space-y-3">
              {completeness.layerScores
                .flatMap((l) => l.gaps.map((g) => ({ ...g, layer: l.layer })))
                .sort((a, b) => (a.severity === "critical" ? -1 : 1))
                .map((gap, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border-l-4 ${
                      gap.severity === "critical"
                        ? "bg-red-50 border-red-500"
                        : gap.severity === "warning"
                          ? "bg-yellow-50 border-yellow-500"
                          : "bg-blue-50 border-blue-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {gap.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          gap.severity === "critical"
                            ? "bg-red-200 text-red-800"
                            : gap.severity === "warning"
                              ? "bg-yellow-200 text-yellow-800"
                              : "bg-blue-200 text-blue-800"
                        }`}
                      >
                        L{gap.layer} {gap.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{gap.suggestion}</p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-green-600">No critical gaps identified!</p>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recommendations
          </h2>
          <ul className="space-y-2">
            {completeness.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-blue-500 mt-0.5">→</span>
                {rec}
              </li>
            ))}
          </ul>

          {gaps.uncontrolledEquipment.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Equipment Without Instrumentation
              </h4>
              <ul className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                {gaps.uncontrolledEquipment.map((eq, i) => (
                  <li key={i}>• {eq.equipment}</li>
                ))}
              </ul>
            </div>
          )}

          {gaps.networkBlindSpots.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Network Blind Spots
              </h4>
              <ul className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                {gaps.networkBlindSpots.map((spot, i) => (
                  <li key={i}>• {spot.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Selected Asset Detail */}
      {selectedAsset && (
        <div className="fixed bottom-4 right-4 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-mono font-bold text-gray-900 dark:text-white">
                {selectedAsset.tagNumber}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedAsset.name}
              </div>
            </div>
            <button
              onClick={() => setSelectedAsset(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="mt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Layer</span>
              <span>
                {selectedAsset.layer}: {LAYER_NAMES[selectedAsset.layer as CanonLayer]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span>{selectedAsset.assetType?.replace(/_/g, " ")}</span>
            </div>
            {selectedAsset.network?.ipAddress && (
              <div className="flex justify-between">
                <span className="text-gray-500">IP</span>
                <span className="font-mono">{selectedAsset.network.ipAddress}</span>
              </div>
            )}
            {selectedAsset.engineering?.processArea && (
              <div className="flex justify-between">
                <span className="text-gray-500">Process Area</span>
                <span>{selectedAsset.engineering.processArea}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workflow Note */}
      <div className="mt-8 p-6 bg-gradient-to-r from-gray-100 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          Why Inventory First?
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Risk cannot be accurately scored until we have a complete inventory. Physics
          calculations require all sensors and actuators. Attack paths need full network
          context. The goal is reaching the point where we both understand the plant and
          believe we could run it.
        </p>
        <div className="flex gap-4 text-sm">
          <div className="flex-1 p-3 bg-white dark:bg-gray-700 rounded">
            <div className="font-medium text-green-600">Phase 1: Inventory</div>
            <div className="text-gray-500">Can we run this plant?</div>
          </div>
          <div className="flex-1 p-3 bg-white dark:bg-gray-700 rounded opacity-50">
            <div className="font-medium text-blue-600">Phase 2: Network</div>
            <div className="text-gray-500">What's connected?</div>
          </div>
          <div className="flex-1 p-3 bg-white dark:bg-gray-700 rounded opacity-50">
            <div className="font-medium text-purple-600">Phase 3: Securability</div>
            <div className="text-gray-500">What CAN be secured?</div>
          </div>
          <div className="flex-1 p-3 bg-white dark:bg-gray-700 rounded opacity-50">
            <div className="font-medium text-orange-600">Phase 4: Risk</div>
            <div className="text-gray-500">Now we can score risk</div>
          </div>
        </div>
      </div>
    </div>
  );
}
