"use client";

import { useState } from "react";

// Demo coverage zones
const DEMO_ZONES = [
  {
    id: "1",
    name: "Control Network",
    layer: 3,
    totalAssets: 45,
    confirmedAssets: 42,
    inferredAssets: 3,
    coveragePercent: 93,
    collectorCount: 1,
    collectors: ["Claroty CTD"],
    recommendation: "adequate",
    recommendationRationale: "High coverage with single collector. No action needed.",
  },
  {
    id: "2",
    name: "Safety System",
    layer: 2,
    totalAssets: 28,
    confirmedAssets: 25,
    inferredAssets: 3,
    coveragePercent: 89,
    collectorCount: 1,
    collectors: ["Claroty CTD"],
    recommendation: "adequate",
    recommendationRationale: "SIS assets visible via control network SPAN.",
  },
  {
    id: "3",
    name: "DMZ",
    layer: 5,
    totalAssets: 38,
    confirmedAssets: 38,
    inferredAssets: 0,
    coveragePercent: 100,
    collectorCount: 2,
    collectors: ["Claroty CTD", "Nozomi Guardian"],
    recommendation: "redundant",
    recommendationRationale: "Two collectors seeing same 38 assets. Consider removing one to reduce cost.",
  },
  {
    id: "4",
    name: "Field Instruments",
    layer: 2,
    totalAssets: 156,
    confirmedAssets: 89,
    inferredAssets: 67,
    coveragePercent: 57,
    collectorCount: 0,
    collectors: [],
    recommendation: "add",
    recommendationRationale: "67 instruments only known from P&IDs. Deploy collector on instrument network to confirm.",
  },
  {
    id: "5",
    name: "Remote I/O",
    layer: 3,
    totalAssets: 24,
    confirmedAssets: 0,
    inferredAssets: 24,
    coveragePercent: 0,
    collectorCount: 0,
    collectors: [],
    recommendation: "add",
    recommendationRationale: "Zero visibility. All assets inferred from I/O lists. Critical blind spot.",
  },
  {
    id: "6",
    name: "Enterprise/Historian",
    layer: 4,
    totalAssets: 12,
    confirmedAssets: 12,
    inferredAssets: 0,
    coveragePercent: 100,
    collectorCount: 0,
    collectors: [],
    recommendation: "adequate",
    recommendationRationale: "All assets confirmed via historian tag database. No collector needed.",
  },
];

// Simulated cost data
const COLLECTOR_COST = 45000; // Annual cost per collector

export default function CoveragePage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const totalAssets = DEMO_ZONES.reduce((sum, z) => sum + z.totalAssets, 0);
  const confirmedAssets = DEMO_ZONES.reduce((sum, z) => sum + z.confirmedAssets, 0);
  const overallCoverage = Math.round((confirmedAssets / totalAssets) * 100);

  const collectorCount = DEMO_ZONES.reduce((sum, z) => sum + z.collectorCount, 0);
  const redundantZones = DEMO_ZONES.filter((z) => z.recommendation === "redundant");
  const blindSpots = DEMO_ZONES.filter((z) => z.recommendation === "add");

  const currentCost = collectorCount * COLLECTOR_COST;
  const potentialSavings = redundantZones.length * COLLECTOR_COST;

  // Calculate optimal coverage
  const optimalCollectors = collectorCount - redundantZones.length + blindSpots.length;
  const optimalCoverage = Math.round(
    ((confirmedAssets + blindSpots.reduce((sum, z) => sum + z.inferredAssets, 0)) / totalAssets) * 100
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Coverage Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">
          Optimize collector placement for maximum visibility at minimum cost
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Overall Coverage</div>
          <div className={`text-3xl font-bold ${overallCoverage >= 80 ? "text-green-600" : overallCoverage >= 60 ? "text-amber-600" : "text-red-600"}`}>
            {overallCoverage}%
          </div>
          <div className="text-xs text-gray-400 mt-1">{confirmedAssets} of {totalAssets} assets</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Active Collectors</div>
          <div className="text-3xl font-bold text-gray-900">{collectorCount}</div>
          <div className="text-xs text-gray-400 mt-1">${(currentCost / 1000).toFixed(0)}k/year</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="text-sm text-red-600">Blind Spots</div>
          <div className="text-3xl font-bold text-red-700">{blindSpots.length}</div>
          <div className="text-xs text-red-600 mt-1">Zones need coverage</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="text-sm text-amber-600">Redundant</div>
          <div className="text-3xl font-bold text-amber-700">{redundantZones.length}</div>
          <div className="text-xs text-amber-600 mt-1">${(potentialSavings / 1000).toFixed(0)}k savings possible</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="text-sm text-blue-600">Optimal State</div>
          <div className="text-3xl font-bold text-blue-700">{optimalCoverage}%</div>
          <div className="text-xs text-blue-600 mt-1">{optimalCollectors} collectors needed</div>
        </div>
      </div>

      {/* Coverage Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Coverage by Zone</h2>
        <div className="space-y-3">
          {DEMO_ZONES.map((zone) => (
            <div
              key={zone.id}
              onClick={() => setSelectedZone(selectedZone === zone.id ? null : zone.id)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedZone === zone.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    zone.recommendation === "adequate"
                      ? "bg-green-500"
                      : zone.recommendation === "redundant"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`} />
                  <span className="font-medium text-gray-900">{zone.name}</span>
                  <span className="text-xs text-gray-400">L{zone.layer}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">{zone.coveragePercent}%</span>
                    <span className="text-xs text-gray-400 ml-1">coverage</span>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <span className="text-sm text-gray-600">{zone.confirmedAssets}/{zone.totalAssets}</span>
                    <span className="text-xs text-gray-400 ml-1">assets</span>
                  </div>
                  <div className="min-w-[100px]">
                    {zone.collectorCount > 0 ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        {zone.collectorCount} collector{zone.collectorCount > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                        No collector
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Coverage bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className="bg-green-500"
                      style={{ width: `${(zone.confirmedAssets / zone.totalAssets) * 100}%` }}
                    />
                    <div
                      className="bg-amber-300"
                      style={{ width: `${(zone.inferredAssets / zone.totalAssets) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {selectedZone === zone.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">Confirmed Assets</div>
                      <div className="text-lg font-semibold text-green-600">{zone.confirmedAssets}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Inferred Assets</div>
                      <div className="text-lg font-semibold text-amber-600">{zone.inferredAssets}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Collectors</div>
                      <div className="text-sm text-gray-700">
                        {zone.collectors.length > 0 ? zone.collectors.join(", ") : "None"}
                      </div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg ${
                    zone.recommendation === "adequate"
                      ? "bg-green-50"
                      : zone.recommendation === "redundant"
                        ? "bg-amber-50"
                        : "bg-red-50"
                  }`}>
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        zone.recommendation === "adequate"
                          ? "bg-green-200 text-green-800"
                          : zone.recommendation === "redundant"
                            ? "bg-amber-200 text-amber-800"
                            : "bg-red-200 text-red-800"
                      }`}>
                        {zone.recommendation === "adequate" ? "OK" : zone.recommendation === "redundant" ? "OPTIMIZE" : "ACTION NEEDED"}
                      </span>
                      <p className="text-sm text-gray-700">{zone.recommendationRationale}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-xs text-gray-500">Confirmed by collectors</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-300" />
            <span className="text-xs text-gray-500">Inferred from engineering data</span>
          </div>
        </div>
      </div>

      {/* Recommendations Panel */}
      <div className="grid grid-cols-2 gap-6">
        {/* Add Collectors */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Deploy Collectors
          </h3>
          {blindSpots.length > 0 ? (
            <div className="space-y-3">
              {blindSpots.map((zone) => (
                <div key={zone.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{zone.name}</span>
                    <span className="text-sm text-red-600">{zone.inferredAssets} unconfirmed</span>
                  </div>
                  <p className="text-sm text-gray-600">{zone.recommendationRationale}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Estimated cost: ${(COLLECTOR_COST / 1000).toFixed(0)}k/year</span>
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      Plan deployment →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No blind spots detected. All zones have adequate coverage.</p>
          )}
        </div>

        {/* Remove Redundant */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Optimize Existing
          </h3>
          {redundantZones.length > 0 ? (
            <div className="space-y-3">
              {redundantZones.map((zone) => (
                <div key={zone.id} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{zone.name}</span>
                    <span className="text-sm text-amber-600">{zone.collectorCount} collectors</span>
                  </div>
                  <p className="text-sm text-gray-600">{zone.recommendationRationale}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Potential savings: ${(COLLECTOR_COST / 1000).toFixed(0)}k/year</span>
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      Review overlap →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No redundant coverage detected. All collectors are efficiently utilized.</p>
          )}
        </div>
      </div>

      {/* ROI Summary */}
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Optimization Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">Current State</div>
            <div className="text-lg font-semibold text-gray-900">{collectorCount} collectors → {overallCoverage}% coverage</div>
            <div className="text-xs text-gray-500">${(currentCost / 1000).toFixed(0)}k/year</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Remove Redundant</div>
            <div className="text-lg font-semibold text-amber-600">-{redundantZones.length} collector{redundantZones.length !== 1 ? "s" : ""}</div>
            <div className="text-xs text-green-600">Save ${(potentialSavings / 1000).toFixed(0)}k/year</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Add for Blind Spots</div>
            <div className="text-lg font-semibold text-blue-600">+{blindSpots.length} collector{blindSpots.length !== 1 ? "s" : ""}</div>
            <div className="text-xs text-gray-500">+${((blindSpots.length * COLLECTOR_COST) / 1000).toFixed(0)}k/year</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Optimal State</div>
            <div className="text-lg font-semibold text-green-600">{optimalCollectors} collectors → {optimalCoverage}% coverage</div>
            <div className="text-xs text-gray-500">${((optimalCollectors * COLLECTOR_COST) / 1000).toFixed(0)}k/year</div>
          </div>
        </div>
      </div>
    </div>
  );
}
